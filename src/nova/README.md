# Nova

**Nova gives your <u>L2 contracts</u> the power to <u>read and write to L1</u> with <u>minimal latency</u> and <u>no trust tradeoffs</u>.** [Read the whitepaper to learn more.](https://github.com/Rari-Capital/nova/blob/master/media/whitepaper/Whitepaper.pdf)

![Diagram](https://lucid.app/publicSegments/view/3cbf2d11-05fe-4f79-ae8b-fcdd4ad11f26/image.png)

## L2_NovaRegistry

This is the primary contract users and contracts will be interacting with. L2 users/contracts can use this contract to [request execution of different strategies](#request-execution), [unlock their tokens](#unlock-tokens), [withdraw their tokens](#withdraw-tokens), and [speed up their requests](#speed-up-a-request).

Relayers will use this contract to view the latest requests, [receive tips for executing requests](#complete-request) and [claim input tokens](#claim-input-tokens).

### Request execution

```solidity
/// @notice A token/amount pair that a relayer will need on L1 to execute the request (and will be returned to them on L2).
/// @param l2Token The token on L2 to transfer to the relayer upon a successful execution.
/// @param amount The amount of l2Token to refund the relayer upon a successful execution.
/// @dev Relayers must reference a list of L2-L1 token mappings to determine the L1 equivalent for an l2Token.
/// @dev The decimal scheme may not align between the L1 and L2 tokens, relayers should check via off-chain logic.
struct InputToken {
    IERC20 l2Token;
    uint256 amount;
}

function requestExec(address strategy, bytes calldata l1Calldata, uint256 gasLimit, uint256 gasPrice, uint256 tip, InputToken[] calldata inputTokens) external returns (bytes32 execHash)
```

Request a strategy to be executed with specific calldata and (optionally) input tokens.

- `strategy`: The address of the "strategy" contract on L1 a relayer should call with `l1calldata`.

- `l1calldata`: The abi encoded calldata a relayer should call the `strategy` with on L1.

- `gasLimit`: The gas limit that will be afforded to the call on L1.

- `gasPrice`: The gas price (in wei) a relayer should use on L1.

- `tip`:The additional wei to pay as a tip for any relayer that successfully executes the request. If the relayer executes the request and the strategy reverts, the creator will be refunded the tip.

- `inputTokens`: An array with a length of 5 or less token/amount pairs that the relayer will need to execute the request on L1. Input tokens are refunded to the relayer on L2 after a successful execution.

* **`RETURN`: The "execHash" (unique identifier) for this request.**

The caller must approve all `inputTokens` to the registry as well as attaching enough ETH to pay for `(gasLimit * gasPrice) + tip`.

### Request execution with a timeout

```solidity
function requestExecWithTimeout(address strategy, bytes calldata l1calldata, uint256 gasLimit, uint256 gasPrice, uint256 tip, InputToken[] calldata inputTokens, uint256 autoUnlockDelaySeconds) external returns (bytes32 execHash)
```

Bundles a call to [`requestExec`](#request-execution) and [`unlockTokens`](#unlock-tokens) into a single transaction.

- `strategy`: [See `requestExec`.](#request-execution)

- `l1calldata`: [See `requestExec`.](#request-execution)

- `gasLimit`: [See `requestExec`.](#request-execution)

- `gasPrice`: [See `requestExec`.](#request-execution)

- `tip`: [See `requestExec`.](#request-execution)

- `inputTokens`: [See `requestExec`.](#request-execution)

- `autoUnlockDelaySeconds`: [See `unlockTokens`.](#unlock-tokens)

- **`RETURN`: [See `requestExec`.](#request-execution)**

::: warning
The user will still have to call [`withdrawTokens`](#withdraw-tokens) once `autoUnlockDelaySeconds` passes.
:::

This function is useful for strategies that are likely to cause hard reverts or not be executed for some reason.

### Unlock tokens

```solidity
function unlockTokens(bytes32 execHash, uint256 unlockDelaySeconds) public
```

This function starts a countdown which lasts for `unlockDelaySeconds`. After the `unlockDelaySeconds` has passed a user is allowed to withdraw their tip/inputs via [`withdrawTokens`](#withdraw-tokens).

- `execHash`: The unique identifier of the request to unlock.

- `unlockDelaySeconds`: The delay in seconds until the creator can withdraw their tokens. Must be greater than or equal to 300.

The caller must be the creator of request.

::: warning
`unlockDelaySeconds` must be >=300 (5 minutes).
:::

A relayer can still execute the request associated with the `execHash` until [`withdrawTokens`](#withdraw-tokens) is called.

### Relock tokens

Reverses a request's completed token unlock (meaning the request had an unlocked scheduled via [`unlockTokens`](#unlock-tokens) and the unlock delay specified has passed).

```solidity
function relockTokens(bytes32 execHash) external
```

- `execHash`: The unique identifier of the request which has been unlocked.

After if a request creator successfully calls this function they will have to call [`unlockTokens`](#unlock-tokens) again if they wish to unlock the request's tokens another time.

The caller must be the creator of the request.

### Withdraw tokens

```solidity
function withdrawTokens(bytes32 execHash) external
```

This function gives a request's creator their input tokens, tip, and gas payment back.

- `execHash`: The unique identifier of the request to withdraw from.

The creator of the request associated with `execHash` must call [`unlockTokens`](#unlock-tokens) and wait the `unlockDelaySeconds` they specified before calling [`withdrawTokens`](#withdraw-tokens).

Anyone may call this function, but the tokens will still go the creator of the request associated with the `execHash`.

### Speed up a request

```solidity
function speedUpRequest(bytes32 execHash, uint256 gasPrice) external returns (bytes32 newExecHash)
```

This function allows a user/contract to increase the gas price for a request they've created.

- `execHash`: The execHash of the request you wish to resubmit with a higher gas price.

- `gasPrice`: The updated gas price to use for the resubmitted request in wei.

- **`RETURN`: The unique identifier for the resubmitted request.**

Calling this function will initiate a 5 minute delay before disabling the request associated with `execHash` (this is known as the "uncled" request) and enabling an updated version of the request (this is known as the resubmitted request which is returned as `newExecHash`).

The caller must be the creator of the request and must also attach enough ETH to pay for the increased gas costs: `(gasPrice - previousGasPrice) * previousGasLimit`.

::: danger
A relayer can still execute the uncled request (`execHash`) up until the delay has passed.
:::

If a relayer executes the uncled request before the delay has passed the resubmitted request will not be executable after the delay and the request creator will be automatically refunded the ETH they attached for the resubmitted request.

### Claim input tokens

Claims input tokens earned from executing a request. Request creators must also call this function if their request reverted (as input tokens are not automatically refunded).

```solidity
function claimInputTokens(bytes32 execHash) external
```

- `execHash`: The hash of the executed request.

Anyone may call this function, but the tokens will be sent to the proper input token recipient (either the `l2Recipient` passed to `execCompleted` or the request creator if the request reverted).

### Check if a request has tokens

```solidity
function hasTokens(bytes32 execHash) public view returns (bool requestHasTokens, uint256 changeTimestamp)
```

Checks if a request exists and hasn't been withdrawn, uncled (scheduled to be sped up), or executed.

- `execHash`: The unique identifier for the request to check.

- **`RETURN`**:

  - `requestHasTokens`: A boolean indicating if the request exists and has all of its tokens.
  - `changeTimestamp`: A timestamp indicating when the request may have its tokens removed or added.

* Resubmitted requests generated via [`speedUpRequest`](#speed-up-a-request) start out with no tokens but have them added after a delay. If `requestHasTokens` is false and but `changeTimestamp` is a timestamp in the future, you know the request is a resubmitted request.

* Requests scheduled to be sped up via [`speedUpRequest`](#speed-up-a-request) start out with tokens but have them removed after a delay. If `requestHasTokens` is true but `changeTimestamp` is a timestamp in the future, you know the request is an uncled request (request scheduled to be sped up).

* If a request exists but hasn't been withdrawn, uncled, or executed, `requestHasTokens` will be true and `changeTimestamp` will be 0.

* If a request doesn't exist or has already been withdrawn, uncled, or executed, `requestHasTokens` will be false and `changeTimestamp` will be 0.

### Check if a request's tokens are unlocked

```solidity
function areTokensUnlocked(bytes32 execHash) public view returns (bool unlocked, uint256 changeTimestamp)
```

Checks if a request has had an unlock completed ([`unlockTokens`](#unlock-tokens) was called and 300 seconds have passed).

- `execHash`: The unique identifier for the request to check.

- **`RETURN`**:
  - `unlocked`: A boolean indicating if the request has had an unlock completed and hence a withdrawal can be triggered.
  - `changeTimestamp`: A timestamp indicating when the request may have its unlock completed.

### Get request data

_Many individual functions are provided to fetch data about a request. Each function takes only one argument, a request's unique identifier (also known as its `execHash`)._

```solidity
function getRequestCreator(bytes32 execHash) external view returns (address)
```

Get the creator of a request.

```solidity
function getRequestStrategy(bytes32 execHash) external view returns (address)
```

Get the address of the strategy associated with a request.

```solidity
function getRequestCalldata(bytes32 execHash) external view returns (bytes memory)
```

Get the calldata associated with a request.

```solidity
function getRequestGasLimit(bytes32 execHash) external view returns (uint256)
```

Get the gas limit that will be used when calling a request's strategy on L1.

```solidity
function getRequestGasPrice(bytes32 execHash) external view returns (uint256)
```

Get the gas price (in wei) a relayer must use to execute a request.

```solidity
function getRequestTip(bytes32 execHash) external view returns (uint256)
```

Get the additional tip (in wei) relayers will receive for successfully executing a request.

```solidity
function getRequestNonce(bytes32 execHash) external view returns (uint256)
```

Get the nonce assigned a request.

```solidity
/// @notice A token/amount pair that a relayer will need on L1 to execute the request (and will be returned to them on L2).
/// @param l2Token The token on L2 to transfer to the relayer upon a successful execution.
/// @param amount The amount of l2Token to refund the relayer upon a successful execution.
/// @dev Relayers must reference a list of L2-L1 token mappings to determine the L1 equivalent for an l2Token.
/// @dev The decimal scheme may not align between the L1 and L2 tokens, relayers should check via off-chain logic.
struct InputToken {
    ERC20 l2Token;
    uint256 amount;
}

function getRequestInputTokens(bytes32 execHash) external view returns (InputToken[] memory)
```

Get the input tokens a relayer must have to execute a request.

```solidity
/// @notice Struct containing data about the status of the request's input tokens.
/// @param recipient The user who is entitled to take the request's input tokens.
/// If recipient is not address(0), this means the request is no longer executable.
/// @param isClaimed Will be true if the input tokens have been removed, false if not.
struct InputTokenRecipientData {
    address recipient;
    bool isClaimed;
}

function getRequestInputTokenRecipientData(bytes32 execHash) external view returns (InputTokenRecipientData memory)
```

Get data about the status of a request's input tokens.

```solidity
function getRequestUnlockTimestamp(bytes32 execHash) external view returns (uint256)
```

Get the timestamp when a request will have its tokens unlocked, meaning the creator can withdraw tokens from the request.

```solidity
function getRequestUncle(bytes32 execHash) external view returns (bytes32)
```

Get a request's "uncle".

```solidity
function getResubmittedRequest(bytes32 execHash) external view returns (bytes32)
```

Get a request's "resubmitted" request.

```solidity
function getRequestDeathTimestamp(bytes32 execHash) external view returns (uint256)
```

Get a timestamp representing when the request will be disabled and replaced by a re-submitted request with a higher gas price.

### Get the execution manager

```solidity
function L1_NovaExecutionManagerAddress() external view returns (address)
```

Get the connected execution manager.

## L1_NovaExecutionManager

Users on L2 never need to interact with this contract. This contract is to facilitate the execution of requests and send messages to reward relayers post-execution.

Strategy contracts may wish to [register themselves](#register-as-strategy) or [hard revert](#trigger-a-hard-revert), [get the current execHash](#get-the-current-exechash) and [transfer tokens from relayers](#transfer-token-from-relayer) during execution.

### Register as a strategy

```solidity
/// @notice Risk classifications for strategies.
enum StrategyRiskLevel {
    // The strategy has not been assigned a risk level.
    // It has the equivalent abilities of a SAFE strategy,
    // but could upgrade itself to an UNSAFE strategy at any time.
    UNKNOWN,
    // The strategy has registered itself as a safe strategy,
    // meaning it cannot use transferFromRelayer or trigger a hard
    // revert. A SAFE strategy cannot upgrade itself to become UNSAFE.
    SAFE,
    // The strategy has registered itself as an unsafe strategy,
    // meaning it has access to all the functionality the execution
    // manager provides like transferFromRelayer and the ability to hard
    // revert. An UNSAFE strategy cannot downgrade itself to become SAFE.
    UNSAFE
}

function registerSelfAsStrategy(StrategyRiskLevel strategyRiskLevel) external
```

Registers the caller as a strategy with the provided in risk level.

- `strategyRiskLevel`: The risk level to register as. Cannot register as `UNKNOWN`.

A strategy can only register once, and will have no way to change its risk level after registering.

### Execute a request

Execute a request with a customizable recipient for the request's reward.

```solidity
function exec(uint256 nonce, address strategy, bytes calldata l1Calldata, uint256 gasLimit, address l2Recipient, uint256 deadline) external
```

- `nonce`: The nonce assigned to the request you wish to execute.

- `strategy`: The strategy provided in the request you wish to execute.

- `l1Calldata`: The calldata provided in the request you wish to execute.

- `gasLimit`: The gas limit provided in the request you wish to execute.

- `l2Recipient`: An address on L2 you wish to receive the request's rewards (gas, tips, input tokens).

- `deadline`: Timestamp after which the transaction will immediately revert.

- `tx.gasprice`: This is not an argument, but an implicit variable the relayer must specify: the request's gas price. Nova requires gas prices be specified in the legacy format (pre-eip1559). To specify a legacy gas price you must use a `type: 0` transaction.

### Trigger a hard revert

```solidity
function hardRevert() external
```

Reverts the entire execution, preventing the relayer from being rewarded.

The execution manager will ignore hard reverts if they are triggered by a [strategy not registered as `UNSAFE`](#get-strategy-risk-level).

### Transfer token from relayer

```solidity
function transferFromRelayer(address token, uint256 amount) external
```

This function transfers tokens the relayer has approved to the [approval escrow](#get-the-approval-escrow) to the currently executing `strategy`.

- `token`: The ER20 token to transfer to the currently executing strategy.
- `amount`: The amount of the token to transfer to the currently executing strategy.

::: danger
Only the currently executing `strategy` can call this function. The [strategy must be registered as `UNSAFE`](#get-strategy-risk-level).
:::

This function will trigger a [hard revert](#trigger-a-hard-revert) if the relayer executing the current strategy has not approved at least `amount` of `token` to the `L1_NovaExecutionManager` (like `safeTransferFrom`).

### Get the approval escrow

```solidity
function L1_NOVA_APPROVAL_ESCROW() external pure returns (address)
```

The address of the approval escrow the execution manager will transfer tokens from in [`transferFromRelayer`](#transfer-token-from-relayer).

### Get the current execHash

```solidity
function currentExecHash() external view returns (bytes32)
```

This function returns the execHash computed from the current call to [`exec`](#execute-a-request).

Strategy contracts may wish to call this function to send messages up to L2 with and tag them with the current execHash.

### Get the current relayer

```solidity
function currentRelayer() external view returns (address)
```

This function returns the current "relayer" (address that made the current call to [`exec`](#execute-a-request)).

Strategy contracts may wish to call this function to ensure only a trusted party is able to execute the strategy or to release additional rewards for the relayer, etc.

### Get strategy risk level

Gets a strategy's risk level.

```solidity
/// @notice Risk classifications for strategies.
enum StrategyRiskLevel {
    // The strategy has not been assigned a risk level.
    // It has the equivalent abilities of a SAFE strategy,
    // but could upgrade itself to an UNSAFE strategy at any time.
    UNKNOWN,
    // The strategy has registered itself as a safe strategy,
    // meaning it cannot use transferFromRelayer or trigger a hard
    // revert. A SAFE strategy cannot upgrade itself to become UNSAFE.
    SAFE,
    // The strategy has registered itself as an unsafe strategy,
    // meaning it has access to all the functionality the execution
    // manager provides like transferFromRelayer and the ability to hard
    // revert. An UNSAFE strategy cannot downgrade itself to become SAFE.
    UNSAFE
}

function getStrategyRiskLevel(address strategy) external view returns (StrategyRiskLevel)
```

Will be `UNKNOWN` if the strategy has not registered itself with the execution manager.
