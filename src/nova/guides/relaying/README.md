# Relayer Guide

Relayers are responsible for detecting new requests in the registry, simulating them, and if they're profitable, executing them.
Some requests may require you to provide your own tokens on L1 to relay the request, in exchange for being reimbursed with equivalent tokens on L2.
Others may not require any tokens at all. Since requests vary in risk and capital requirements, your bot should be selective about the requests it chooses to execute.

Relaying is not as risk free as liquidations or some forms of arbitrage because payouts occur on another layer, meaning flashloans can't be used.
However, with this additional risk comes additional reward, as relaying will be far less competitive and require more specialization.

To ensure relayers do not compete in a harmful manner, we are currently only whitelisting relayers who in active communication with us and each other.
Don't hesitate to reach out to [@transmissions11](https://twitter.com/transmissions11) if becoming a relayer interests you.

## Relaying Step-By-Step

![Flowchart](https://lucid.app/publicSegments/view/d392039a-8d54-43f0-9c80-f7943889779f/image.png)

1. Watch for [`RequestExec` events in the `L2_NovaRegistry`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L69).

2. Call the [`getStrategyRiskLevel` function on the `L1_NovaExecutionManager`](https://github.com/Rari-Capital/nova/blob/master/contracts/L1_NovaExecutionManager.sol#L146) with the `strategy` field of the `RequestExec` event and check if the return value is [`StrategyRiskLevel.SAFE`](https://github.com/Rari-Capital/nova/blob/master/contracts/L1_NovaExecutionManager.sol#L136) (in `uint8` form it will be represented as `1`).

3. Check the `strategy` against a human curated whitelist of `UNSAFE`/`UNKNOWN` strategies you trust.
   `UNSAFE`/`UNKNOWN` strategies can revert `exec` transactions arbitrarily and transfer tokens approved to the `L1_NovaApprovalEscrow`, so be careful.

4. Call the [`getRequestInputTokens` function on the `L2_NovaRegistry`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L142) with the `execHash` field of the [`RequestExec`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L69) event and check if the return value is a non-empty array.

5. Check if your balance of each of the input tokens returned from [`getRequestInputTokens`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L142) is greater than or or equal to the amount specified.

   - This is slightly more difficult than it may initially seem as the [`InputTokenData`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L132) struct only includes the address of the input token on L2, not the expected equivalent on L1. To resolve this, use token lists that map L2 tokens to their L1 equivalents. One such example is [Optimism's Token List](https://static.optimism.io/optimism.tokenlist.json).

   - Remember that the decimals used for input tokens on L2 may not match the decimals of the equivalent L1 tokens. Ensure you normalize input token amounts to use each token's L1 decimals before comparing your balance.

6. Any method for purchasing tokens is sufficient.

7. Simulate a call to [`exec` on the `L1_NovaExecutionManager`](https://github.com/Rari-Capital/nova/blob/master/contracts/L1_NovaExecutionManager.sol#L132) with the proper input tokens for the request approved to the [`L1_NOVA_APPROVAL_ESCROW`](https://github.com/Rari-Capital/nova/blob/master/contracts/L1_NovaExecutionManager.sol#L50). Exec accepts five arguments explicitly, and one implicitly (gas price):

   - `nonce`: The nonce assigned to the request. You can fetch the request's nonce using the [`getRequestNonce` function on the `L2_NovaRegistry`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L125)

   - `strategy`: The strategy provided in the request. You can fetch the request's strategy using the [`getRequestStrategy` function on the `L2_NovaRegistry`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L109)

   - `l1Calldata`: The calldata provided in the request. You can fetch the request's calldata using the [`getRequestCalldata` function on the `L2_NovaRegistry`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L112)

   - `gasLimit`: The gas limit provided in the request. You can fetch the request's gas limit using the [`getRequestGasLimit` function on the `L2_NovaRegistry`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L115)

   - `l2Recipient`: An address on L2 you wish to receive the request's rewards (gas, tips, input tokens).

   - `deadline`: Timestamp after which the transaction will immediately revert. The deadline should be set to the timestamp when the request was created plus [`MIN_UNLOCK_DELAY_SECONDS`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L30) for safety (as requests can be canceled afterwards).

   - `tx.gasprice`: This is not an argument, but an implicit variable the relayer must specify: gas price. Nova requires gas prices be specified in the legacy format (pre-eip559).
     You can find the request's provided gas price using the [`getRequestGasPrice` function on the `L2_NovaRegistry`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L118).
     To specify a legacy gas price you must use a `type: 0` transaction.

8. Check if the transaction reverted.

9. See step #4

10. Approve the correct amount of each input tokens returned from [`getRequestInputTokens`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L142) to the address returned from the [`L1_NOVA_APPROVAL_ESCROW` function on the `L1_NovaExecutionManager`](https://github.com/Rari-Capital/nova/blob/master/contracts/L1_NovaExecutionManager.sol#L50). See step #5 for important details on how to determine each input token's L1 address and if you need to normalize each token's amount to use the proper decimals.

11. Call [`exec` on the `L1_NovaExecutionManager`](https://github.com/Rari-Capital/nova/blob/master/contracts/L1_NovaExecutionManager.sol#L132) with all the correct parameters (see step #7 for details).

12. See step #4

13. Call the [`claimInputTokens` function on the `L2_NovaRegistry`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L280) with the relevant `execHash`.

## Gotchas/Failure Modes

- **Running out of ETH.** Your relayer will not be able to execute requests if it does not have enough ETH to pay for gas on L1. Keep your relayers well funded and monitor them closely.

- **Using the wrong `L1_NovaExecutionManager`.** The `L1_NovaExecutionManager` cannot be upgraded, but the `L2_NovaRegistry`'s owner can swap out the `L1_NovaExecutionManager` it accepts messages from at any time. Make sure to always use the latest version returned by the [`L1_NovaExecutionManagerAddress` function in the `L2_NovaRegistry`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L40).

- **Specifying an `l2Recipient` you don't control.** The [`L1_NovaExecutionManager`'s `exec` function](https://github.com/Rari-Capital/nova/blob/master/contracts/L1_NovaExecutionManager.sol#L132) gives you the flexibility to specify an arbitrary address you wish to receive the request's rewards (gas, tips, input tokens). If you specify an address you do not control, you will not be able to receive the tokens.

- **Not using safe deadlines.** The `deadline` argument the [`exec` function in the `L1_NovaExecutionManager`](https://github.com/Rari-Capital/nova/blob/master/contracts/L1_NovaExecutionManager.sol#L132) accepts is critical to ensuring relayers do not lose funds due to users canceling or speeding up their requests. Always use a deadline less than or equal to [`MIN_UNLOCK_DELAY_SECONDS`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L30) in the future to protect yourself.

- **Not using multiple accounts or vetting gas prices.** Since Ethereum txs are executed sequentially (a tx with nonce of 1 must be included before a tx with a nonce of 2), it is important to carefully manage
  either which requests you execute or how you execute them, to prevent a request with a lower gas price from preventing you from executing other requests. Prefer using multiple addresses to execute requests in parallel, or carefully vet gas prices for each request to ensure they are reasonable. You may also wish to use a service like [Flashbots](https://github.com/flashbots/pm) to sidestep the sequential nature of transactions all together.

- **Using the wrong input token addresses and/or decimals on L1.** The [`L2_NovaRegistry`'s `InputTokenData`](https://github.com/Rari-Capital/nova/blob/master/contracts/L2_NovaRegistry.sol#L132) struct only includes the address of the input token on L2, not the expected equivalent on L1. When executing requests with input tokens, you must keep this in mind and use token lists that map L2 tokens to their L1 equivalents to find the correct tokens to purchase and approve to the `L1_NovaApprovalEscrow`. You may also have to normalize input token amounts to use each token's L1 decimals, as decimals used for input tokens on L2 may not match the decimals of the equivalent L1 tokens.

- **Trusting arbitrary `UNSAFE`/`UNKNOWN` strategies.** Strategies registered as `UNSAFE` can revert calls to [`exec`](https://github.com/Rari-Capital/nova/blob/master/contracts/L1_NovaExecutionManager.sol#L132) arbitrarily and transfer tokens approved to the `L1_NovaApprovalEscrow` at will. `UNKNOWN` strategies are just as dangerous, as they can register as an `UNSAFE` strategy at any time. Only execute requests that use `SAFE` strategies or `UNSAFE` strategies you've personally vetted.
