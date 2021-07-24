# Fuse

The Fuse platform enables anyone to instantly create their own lending and borrowing pool. Below you will find documentation for the Fuse platform. Each Fuse pool is essentially a fork of the Compound protocol.

## General

### Interpreting Exchange Rates

The fToken exchange rate is scaled by the difference in decimals between the fToken and the underlying asset.

```js
const onefTokenInUnderlying =
  exchangeRateCurrent / ((1 * 10) ^ (18 + underlyingDecimals - fTokenDecimals));
```

Here is an example of finding the value of 1 fBAT in BAT with Web3.js JavaScript.

```js
const fTokenDecimals = 8; // all fTokens have 8 decimal places

const underlying = new web3.eth.Contract(erc20Abi, batAddress);

const fToken = new web3.eth.Contract(fTokenAbi, fBATAddress);

const underlyingDecimals = await underlying.methods.decimals().call();

const exchangeRateCurrent = await fToken.methods.exchangeRateCurrent().call();

const mantissa = 18 + parseInt(underlyingDecimals) - fTokenDecimals;

const onefTokenInUnderlying = exchangeRateCurrent / Math.pow(10, mantissa);

console.log("1 fBAT can be redeemed for", onefTokenInUnderlying, "BAT");
```

There is no underlying contract for ETH, so to do this with fETH, set underlyingDecimals to 18.

To find the number of underlying tokens that can be redeemed for fTokens, multiply the number of fTokens by the above value onefTokenInUnderlying.

```js
const underlyingTokens = fTokenAmount * onefTokenInUnderlying;
```

### Calculating Accrued Interest

Interest rates for each market update on any block in which the ratio of borrowed assets to supplied assets in the market has changed. The amount interest rates are changed depends on the interest rate model smart contract implemented for the market, and the amount of change in the ratio of borrowed assets to supplied assets in the market.

See the interest rate data visualization notebook on [Observable](https://observablehq.com/@jflatow/compound-interest-rates) to visualize which interest rate model is currently applied to each market.

Historical interest rates can be retrieved from the [MarketHistoryService API](https://compound.finance/docs/api#MarketHistoryService).

Interest accrues to all suppliers and borrowers in a market when any Ethereum address interacts with the market’s fToken contract, calling one of these functions: mint, redeem, borrow, or repay. Successful execution of one of these functions triggers the accrueInterest method, which causes interest to be added to the underlying balance of every supplier and borrower in the market. Interest accrues for the current block, as well as each prior block in which the accrueInterest method was not triggered (no user interacted with the fToken contract). Interest compounds only during blocks in which the fToken contract has one of the aforementioned methods invoked.

Here is an example of supply interest accrual:

Alice supplies 1 ETH to the Fuse protocol. At the time of supply, the supplyRatePerBlock is 37893605 Wei, or 0.000000000037893605 ETH per block. No one interacts with the fETHer contract for 3 Ethereum blocks. On the subsequent 4th block, Bob borrows some ETH. Alice’s underlying balance is now 1.000000000151574420 ETH (which is 37893605 Wei times 4 blocks, plus the original 1 ETH). Alice’s underlying ETH balance in subsequent blocks will have interest accrued based on the new value of 1.000000000151574420 ETH instead of the initial 1 ETH. Note that the supplyRatePerBlock value may change at any time.

### Calculating the APY Using Rate Per Block

The Annual Percentage Yield (APY) for supplying or borrowing in each market can be calculated using the value of supplyRatePerBlock (for supply APY) or borrowRatePerBlock (for borrow APY) in this formula:

```js
Rate = fToken.supplyRatePerBlock(); // Integer

Rate = 37893566

ETH Mantissa = 1 * 10 ^ 18 (ETH has 18 decimal places)

Blocks Per Day = 4 * 60 * 24 (based on 4 blocks occurring every minute)

Days Per Year = 365

APY = ((((Rate / ETH Mantissa * Blocks Per Day + 1) ^ Days Per Year)) - 1) * 100
```

Here is an example of calculating the supply and borrow APY with Web3.js JavaScript:

```js
const ethMantissa = 1e18;

const blocksPerDay = 4 * 60 * 24;

const daysPerYear = 365;

const fToken = new web3.eth.Contract(fETHAbi, fETHAddress);

const supplyRatePerBlock = await fToken.methods.supplyRatePerBlock().call();

const borrowRatePerBlock = await fToken.methods.borrowRatePerBlock().call();

const supplyApy =
  (Math.pow(
    (supplyRatePerBlock / ethMantissa) * blocksPerDay + 1,
    daysPerYear
  ) -
    1) *
  100;

const borrowApy =
  (Math.pow(
    (borrowRatePerBlock / ethMantissa) * blocksPerDay + 1,
    daysPerYear
  ) -
    1) *
  100;

console.log(`Supply APY for ETH ${supplyApy} %`);

console.log(`Borrow APY for ETH ${borrowApy} %`);
```

### Gas Costs

The gas usage of the protocol functions may fluctuate by market and user. External calls, such as to underlying ERC-20 tokens, may use an arbitrary amount of gas. Any calculations that involve checking [account liquidity](https://compound.finance/docs/comptroller#account-liquidity), have gas costs that increase with the number of [entered markets](https://compound.finance/docs/comptroller#enter-markets). Thus, while it can be difficult to provide any guarantees about costs, we provide the table below for guidance:

| Function         | Typical Gas Cost                     |
| ---------------- | ------------------------------------ |
| Mint             | < 150K, fDAI < 300k                  |
| Redeem, Transfer | < 250K if borrowing, otherwise < 90K |
| Borrow           | < 300K                               |
| Repay Borrow     | < 90K                                |
| Liquidate Borrow | < 400K                               |

## fToken(s)

### Mint

The mint function transfers an asset into the protocol, which begins accumulating interest based on the current [Supply Rate](https://compound.finance/docs/fTokens#supply-rate) for the asset. The user receives a quantity of fTokens equal to the underlying tokens supplied, divided by the current [Exchange Rate](https://compound.finance/docs/fTokens#exchange-rate).

#### fERC20

```solidity
function mint(uint mintAmount) returns (uint)
```

- `msg.sender`: The account which shall supply the asset, and own the minted fTokens.
- `mintAmount`: The amount of the asset to be supplied, in units of the underlying asset.
- `RETURN`: 0 on success, otherwise an [Error code](https://compound.finance/docs/fTokens#error-codes)

Before supplying an asset, users must first [approve](https://eips.ethereum.org/EIPS/eip-20#approve) the fToken to access their token balance.

#### fEther

```solidity
function mint() payable
```

- `msg.value`: The amount of ether to be supplied, in wei.
- `msg.sender`: The account which shall supply the ether, and own the minted fTokens.
- `RETURN`: No return, reverts on error.

#### Solidity

```solidity
Erc20 underlying = Erc20(0xToken...);     // get a handle for the underlying asset contract

fERC20 fToken = fERC20(0x3FDA...);        // get a handle for the corresponding fToken contract

underlying.approve(address(fToken), 100); // approve the transfer

assert(fToken.mint(100) == 0);            // mint the fTokens and assert there is no error
```

#### Web3 1.0

```js
const fToken = fEther.at(0x3FDB...);

await fToken.methods.mint().send({from: myAccount, value: 50});
```

### Redeem

The redeem function converts a specified quantity of fTokens into the underlying asset, and returns them to the user. The amount of underlying tokens received is equal to the quantity of fTokens redeemed, multiplied by the current [Exchange Rate](https://compound.finance/docs/fTokens#exchange-rate). The amount redeemed must be less than the user's [Account Liquidity](https://compound.finance/docs/comptroller#account-liquidity) and the market's available liquidity.

#### fERC20 / fEther

```solidity
function redeem(uint redeemTokens) returns (uint)
```

- `msg.sender`: The account to which redeemed funds shall be transferred.
- `redeemTokens`: The number of fTokens to be redeemed.
- `RETURN`: 0 on success, otherwise an [Error code](https://compound.finance/docs/fTokens#error-codes)

#### Solidity

```solidity
fEther fToken = fEther(0x3FDB...);

require(fToken.redeem(7) == 0, "something went wrong");
```

#### Web3 1.0

```js
const fToken = fERC20.at(0x3FDA...);

fToken.methods.redeem(1).send({from: ...});
```

### Redeem Underlying

The redeem underlying function converts fTokens into a specified quantity of the underlying asset, and returns them to the user. The amount of fTokens redeemed is equal to the quantity of underlying tokens received, divided by the current [Exchange Rate](https://compound.finance/docs/fTokens#exchange-rate). The amount redeemed must be less than the user's [Account Liquidity](https://compound.finance/docs/comptroller#account-liquidity) and the market's available liquidity.

#### fERC20 / fEther

```solidity
function redeemUnderlying(uint redeemAmount) returns (uint)
```

- `msg.sender`: The account to which redeemed funds shall be transferred.
- `redeemAmount`: The amount of underlying to be redeemed.
- `RETURN`: 0 on success, otherwise an [Error code](https://compound.finance/docs/fTokens#error-codes)

#### Solidity

```solidity
fEther fToken = fEther(0x3FDB...);

require(fToken.redeemUnderlying(50) == 0, "something went wrong");
```

#### Web3 1.0

```js
const fToken = fERC20.at(0x3FDA...);

fToken.methods.redeemUnderlying(10).send({from: ...});
```

### Borrow

The borrow function transfers an asset from the protocol to the user, and creates a borrow balance which begins accumulating interest based on the [Borrow Rate](https://compound.finance/docs/fTokens#borrow-rate) for the asset. The amount borrowed must be less than the user's [Account Liquidity](https://compound.finance/docs/comptroller#account-liquidity) and the market's available liquidity.

To borrow Ether, the borrower must be 'payable' (solidity).

#### fERC20 / fEther

```solidity
function borrow(uint borrowAmount) returns (uint)
```

- `msg.sender`: The account to which borrowed funds shall be transferred.
- `borrowAmount` : The amount of the underlying asset to be borrowed.
- `RETURN`: 0 on success, otherwise an [Error code](https://compound.finance/docs/fTokens#error-codes)

#### Solidity

```solidity
fERC20 fToken = fERC20(0x3FDA...);

require(fToken.borrow(100) == 0, "got collateral?");
```

#### Web3 1.0

```js
const fToken = fEther.at(0x3FDB...);

await fToken.methods.borrow(50).send({from: 0xMyAccount});
```

### Repay Borrow

The repay function transfers an asset into the protocol, reducing the user's borrow balance.

#### fERC20

```solidity
function repayBorrow(uint repayAmount) returns (uint)
```

- `msg.sender`: The account which borrowed the asset, and shall repay the borrow.
- `repayAmount`: The amount of the underlying borrowed asset to be repaid. A value of -1 (i.e. 2256 - 1) can be used to repay the full amount.
- `RETURN`: 0 on success, otherwise an [Error code](https://compound.finance/docs/fTokens#error-codes)

Before repaying an asset, users must first [approve](https://eips.ethereum.org/EIPS/eip-20#approve) the fToken to access their token balance.

#### fEther

```solidity
function repayBorrow() payable
```

- `msg.value`: The amount of ether to be repaid, in wei.
- `msg.sender`: The account which borrowed the asset, and shall repay the borrow.
- `RETURN`: No return, reverts on error.

#### Solidity

```solidity
fEther fToken = fEther(0x3FDB...);

require(fToken.repayBorrow.value(100)() == 0, "transfer approved?");
```

#### Web3 1.0

```js
const fToken = fERC20.at(0x3FDA...);

fToken.methods.repayBorrow(10000).send({from: ...});
```

### Repay Borrow Behalf

The repay function transfers an asset into the protocol, reducing the target user's borrow balance.

#### fERC20

```solidity
function repayBorrowBehalf(address borrower, uint repayAmount) returns (uint)
```

- `msg.sender`: The account which shall repay the borrow.
- `borrower`: The account which borrowed the asset to be repaid.
- `repayAmount`: The amount of the underlying borrowed asset to be repaid. A value of -1 (i.e. 2256 - 1) can be used to repay the full amount.
- `RETURN`: 0 on success, otherwise an [Error code](https://compound.finance/docs/fTokens#error-codes)

Before repaying an asset, users must first [approve](https://eips.ethereum.org/EIPS/eip-20#approve) the fToken to access their token balance.

#### fEther

```solidity
function repayBorrowBehalf(address borrower) payable
```

- `msg.value`: The amount of ether to be repaid, in wei.
- `msg.sender`: The account which shall repay the borrow.
- `borrower`: The account which borrowed the asset to be repaid.
- `RETURN`: No return, reverts on error.

#### Solidity

```solidity
fEther fToken = fEther(0x3FDB...);

require(fToken.repayBorrowBehalf.value(100)(0xBorrower) == 0, "transfer approved?");
```

#### Web3 1.0

```js
const fToken = fERC20.at(0x3FDA...);

await fToken.methods.repayBorrowBehalf(0xBorrower, 10000).send({from: 0xPayer});
```

### Liquidate Borrow

A user who has negative [account liquidity](https://compound.finance/docs/comptroller#account-liquidity) is subject to [liquidation](https://compound.finance/docs/fTokens#liquidate-borrow) by other users of the protocol to return his/her account liquidity back to positive (i.e. above the collateral requirement). When a liquidation occurs, a liquidator may repay some or all of an outstanding borrow on behalf of a borrower and in return receive a discounted amount of collateral held by the borrower; this discount is defined as the liquidation incentive.

A liquidator may close up to a certain fixed percentage (i.e. close factor) of any individual outstanding borrow of the underwater account. Unlike in v1, liquidators must interact with each fToken contract in which they wish to repay a borrow and seize another asset as collateral. When collateral is seized, the liquidator is transferred fTokens, which they may redeem the same as if they had supplied the asset themselves. Users must approve each fToken contract before calling liquidate (i.e. on the borrowed asset which they are repaying), as they are transferring funds into the contract.

```solidity
function liquidateBorrow(address borrower, uint amount, address collateral) returns (uint)
```

- `msg.sender`: The account which shall liquidate the borrower by repaying their debt and seizing their collateral.
- `borrower`: The account with negative account liquidity that shall be liquidated.
- `repayAmount`: The amount of the borrowed asset to be repaid and converted into collateral, specified in units of the underlying borrowed asset.
- `fTokenCollateral`: The address of the fToken currently held as collateral by a borrower, that the liquidator shall seize.
- `RETURN`: 0 on success, otherwise an Error code

### Transfer

Transfer is an ERC-20 method that allows accounts to send tokens to other Ethereum addresses. A fToken transfer will fail if the account has [entered](https://compound.finance/docs/comptroller#enter-markets) that fToken market and the transfer would have put the account into a state of negative [liquidity](https://compound.finance/docs/comptroller#account-liquidity).

#### fERC20 / fEther

```solidity
function transfer(address recipient, uint256 amount) returns (bool)
```

- `recipient`: The transfer recipient address.
- `amount`: The amount of fTokens to transfer.
- `RETURN`: Returns a boolean value indicating whether or not the operation succeeded.

#### Solidity

```solidity
fEther fToken = fEther(0x3FDB...);

fToken.transfer(0xABCD..., 100000000000);
```

#### Web3 1.0

```solidity
const fToken = fERC20.at(0x3FDA...);

await fToken.methods.transfer(0xABCD..., 100000000000).send({from: 0xSender});
```

#### fERC20

```solidity
function liquidateBorrow(address borrower, uint amount, address collateral) returns (uint)
```

- `msg.sender`: The account which shall liquidate the borrower by repaying their debt and seizing their collateral.
- `borrower`: The account with negative [account liquidity](https://compound.finance/docs/comptroller#account-liquidity) that shall be liquidated.
- `repayAmount`: The amount of the borrowed asset to be repaid and converted into collateral, specified in units of the underlying borrowed asset.
- `collateral`: The address of the fToken currently held as collateral by a borrower, that the liquidator shall seize.
- `RETURN`: 0 on success, otherwise an [Error code](https://compound.finance/docs/fTokens#error-codes)

Before supplying an asset, users must first [approve](https://eips.ethereum.org/EIPS/eip-20#approve) the fToken to access their token balance.

#### fEther

```solidity
function liquidateBorrow(address borrower, address fTokenCollateral) payable
```

- `msg.value`: The amount of ether to be repaid and converted into collateral, in wei.
- `msg.sender`: The account which shall liquidate the borrower by repaying their debt and seizing their collateral.
- `borrower`: The account with negative [account liquidity](https://compound.finance/docs/comptroller#account-liquidity) that shall be liquidated.
- `collateral`: The address of the fToken currently held as collateral by a borrower, that the liquidator shall seize.
- `RETURN`: No return, reverts on error.

#### Solidity

```solidity
fEther fToken = fEther(0x3FDB...);

fERC20 fTokenCollateral = fERC20(0x3FDA...);

require(fToken.liquidateBorrow.value(100)(0xBorrower, fTokenCollateral) == 0, "borrower underwater??");
```

#### Web3 1.0

```solidity
const fToken = fERC20.at(0x3FDA...);

const fTokenCollateral = fEther.at(0x3FDB...);

await fToken.methods.liquidateBorrow(0xBorrower, 33, fTokenCollateral).send({from: 0xLiquidator});
```

### Exchange Rate

Each fToken is convertible into an ever increasing quantity of the underlying asset, as interest accrues in the market. The exchange rate between a fToken and the underlying asset is equal to:

```solidity
exchangeRate = (getCash() + totalBorrows() - totalReserves()) / totalSupply()
```

#### fERC20 / fEther

```solidity
function exchangeRateCurrent() returns (uint)
```

- `RETURN`: The current exchange rate as an unsigned integer, scaled by 1e18.

#### Solidity

```solidity
fERC20 fToken = fToken(0x3FDA...);

uint exchangeRateMantissa = fToken.exchangeRateCurrent();
```

#### Web3 1.0

```js
const fToken = fEther.at(0x3FDB...);

const exchangeRate = (await fToken.methods.exchangeRateCurrent().call()) / 1e18;
```

Tip: note the use of call vs. send to invoke the function from off-chain without incurring gas costs.

### Get Cash

Cash is the amount of underlying balance owned by this fToken contract. One may query the total amount of cash currently available to this market.

#### fERC20 / fEther

```solidity
function getCash() returns (uint)
```

- `RETURN`: The quantity of underlying asset owned by the contract.

#### Solidity

```solidity
fERC20 fToken = fToken(0x3FDA...);

uint cash = fToken.getCash();
```

#### Web3 1.0

```js
const fToken = fEther.at(0x3FDB...);

const cash = (await fToken.methods.getCash().call());
```

### Total Borrow

Total Borrows is the amount of underlying currently loaned out by the market, and the amount upon which interest is accumulated to suppliers of the market.

#### fERC20 / fEther

```solidity
function totalBorrowsCurrent() returns (uint)
```

- `RETURN`: The total amount of borrowed underlying, with interest.

#### Solidity

```solidity
fERC20 fToken = fToken(0x3FDA...);

uint borrows = fToken.totalBorrowsCurrent();
```

#### Web3 1.0

```js
const fToken = fEther.at(0x3FDB...);

const borrows = (await fToken.methods.totalBorrowsCurrent().call());
```

### Borrow Balance

A user who borrows assets from the protocol is subject to accumulated interest based on the current [borrow rate](https://compound.finance/docs/fTokens#borrow-rate). Interest is accumulated every block and integrations may use this function to obtain the current value of a user's borrow balance with interest.

#### fERC20 / fEther

```solidity
function borrowBalanceCurrent(address account) returns (uint)
```

- `account`: The account which borrowed the assets.
- `RETURN`: The user's current borrow balance (with interest) in units of the underlying asset.

#### Solidity

```solidity
fERC20 fToken = fToken(0x3FDA...);

uint borrows = fToken.borrowBalanceCurrent(msg.caller);
```

#### Web3 1.0

```js
const fToken = fEther.at(0x3FDB...);

const borrows = await fToken.methods.borrowBalanceCurrent(account).call();
```

### Borrow Rate

At any point in time one may query the contract to get the current borrow rate per block.

#### fERC20 / fEther

```solidity
function borrowRatePerBlock() returns (uint)
```

- `RETURN`: The current borrow rate as an unsigned integer, scaled by 1e18.

#### Solidity

```solidity
fERC20 fToken = fToken(0x3FDA...);

uint borrowRateMantissa = fToken.borrowRatePerBlock();
```

#### Web3 1.0

```js
const fToken = fEther.at(0x3FDB...);

const borrowRate = (await fToken.methods.borrowRatePerBlock().call()) / 1e18;
```

### Total Supply

Total Supply is the number of tokens currently in circulation in this fToken market. It is part of the EIP-20 interface of the fToken contract.

#### fERC20 / fEther

```solidity
function totalSupply() returns (uint)
```

- `RETURN`: The total number of tokens in circulation for the market.

#### Solidity

```solidity
fERC20 fToken = fToken(0x3FDA...);

uint tokens = fToken.totalSupply();
```

#### Web3 1.0

```js
const fToken = fEther.at(0x3FDB...);

const tokens = (await fToken.methods.totalSupply().call());
```

### Underlying Balance

The user's underlying balance, representing their assets in the protocol, is equal to the user's fToken balance multiplied by the [Exchange Rate](https://compound.finance/docs/fTokens#exchange-rate).

#### fERC20 / fEther

```solidity
function balanceOfUnderlying(address account) returns (uint)
```

- `account`: The account to get the underlying balance of.
- `RETURN`: The amount of underlying currently owned by the account.

#### Solidity

```solidity
fERC20 fToken = fToken(0x3FDA...);

uint tokens = fToken.balanceOfUnderlying(msg.caller);
```

#### Web3 1.0

```js
const fToken = fEther.at(0x3FDB...);

const tokens = await fToken.methods.balanceOfUnderlying(account).call();
```

### Supply Rate

At any point in time one may query the contract to get the current supply rate per block. The supply rate is derived from the [borrow rate](https://compound.finance/docs/fTokens#borrow-rate), [reserve factor](https://compound.finance/docs/fTokens#reserve-factor) and the amount of [total borrows](https://compound.finance/docs/fTokens#total-borrows).

#### fERC20 / fEther

```solidity
function supplyRatePerBlock() returns (uint)
```

- `RETURN`: The current supply rate as an unsigned integer, scaled by 1e18.

#### Solidity

```solidity
fERC20 fToken = fToken(0x3FDA...);

uint supplyRateMantissa = fToken.supplyRatePerBlock();
```

#### Web3 1.0

```js
const fToken = fEther.at(0x3FDB...);

const supplyRate = (await fToken.methods.supplyRatePerBlock().call()) / 1e18;
```

### Total Reserves

Reserves are an accounting entry in each fToken contract that represents a portion of historical interest set aside as [cash](https://compound.finance/docs/fTokens#cash) which can be withdrawn or transferred through the protocol's governance. A small portion of borrower interest accrues into the protocol, determined by the [reserve factor](https://compound.finance/docs/fTokens#reserve-factor).

#### fERC20 / fEther

```solidity
function totalReserves() returns (uint)
```

- `RETURN`: The total amount of reserves held in the market.

#### Solidity

```solidity
fERC20 fToken = fToken(0x3FDA...);

uint reserves = fToken.totalReserves();
```

#### Web3 1.0

```js
const fToken = fEther.at(0x3FDB...);

const reserves = (await fToken.methods.totalReserves().call());
```

### Reserve Factor

The reserve factor defines the portion of borrower interest that is converted into [reserves](https://compound.finance/docs/fTokens#total-reserves).

#### fERC20 / fEther

```solidity
function reserveFactorMantissa() returns (uint)
```

- `RETURN`: The current reserve factor as an unsigned integer, scaled by 1e18.

#### Solidity

```solidity
fERC20 fToken = fToken(0x3FDA...);

uint reserveFactorMantissa = fToken.reserveFactorMantissa();
```

#### Web3 1.0

```js
const fToken = fEther.at(0x3FDB...);

const reserveFactor = (await fToken.methods.reserveFactorMantissa().call()) / 1e18;
```

### Key Events

| Event                                                                                                               | Description                                                                                           |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Mint(address minter, uint mintAmount, uint mintTokens)                                                              | Emitted upon a successful [Mint](https://compound.finance/docs/fTokens#mint).                         |
| Redeem(address redeemer, uint redeemAmount, uint redeemTokens)                                                      | Emitted upon a successful [Redeem](https://compound.finance/docs/fTokens#redeem).                     |
| Borrow(address borrower, uint borrowAmount, uint accountBorrows, uint totalBorrows)                                 | Emitted upon a successful [Borrow](https://compound.finance/docs/fTokens#borrow).                     |
| RepayBorrow(address payer, address borrower, uint repayAmount, uint accountBorrows, uint totalBorrows)              | Emitted upon a successful [Repay Borrow](https://compound.finance/docs/fTokens#repay-borrow).         |
| LiquidateBorrow(address liquidator, address borrower, uint repayAmount, address fTokenCollateral, uint seizeTokens) | Emitted upon a successful [Liquidate Borrow](https://compound.finance/docs/fTokens#liquidate-borrow). |

### Error Codes

| Code | Name                           | Description                                                                                                                                                                                                      |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | NO_ERROR                       | Not a failure.                                                                                                                                                                                                   |
| 1    | UNAUTHORIZED                   | The sender is not authorized to perform this action.                                                                                                                                                             |
| 2    | BAD_INPUT                      | An invalid argument was supplied by the caller.                                                                                                                                                                  |
| 4    | COMPTROLLER_CALCULATION_ERROR  | An internal calculation has failed in the comptroller.                                                                                                                                                           |
| 5    | INTEREST_RATE_MODEL_ERROR      | The interest rate model returned an invalid value.                                                                                                                                                               |
| 6    | INVALID_ACCOUNT_PAIR           | The specified combination of accounts is invalid.                                                                                                                                                                |
| 7    | INVALID_CLOSE_AMOUNT_REQUESTED | The amount to liquidate is invalid.                                                                                                                                                                              |
| 8    | INVALID_COLLATERAL_FACTOR      | The collateral factor is invalid.                                                                                                                                                                                |
| 9    | MATH_ERROR                     | A math calculation error occurred.                                                                                                                                                                               |
| 10   | MARKET_NOT_FRESH               | Interest has not been properly accrued.                                                                                                                                                                          |
| 11   | MARKET_NOT_LISTED              | The market is not currently listed by its comptroller.                                                                                                                                                           |
| 12   | TOKEN_INSUFFICIENT_ALLOWANCE   | ERC-20 contract must _allow_ Money Market contract to call transferFrom. The current allowance is either 0 or less than the requested supply, repayBorrow or liquidate amount.                                   |
| 13   | TOKEN_INSUFFICIENT_BALANCE     | Caller does not have sufficient balance in the ERC-20 contract to complete the desired action.                                                                                                                   |
| 14   | TOKEN_INSUFFICIENT_CASH        | The market does not have a sufficient cash balance to complete the transaction. You may attempt this transaction again later.                                                                                    |
| 15   | TOKEN_TRANSFER_IN_FAILED       | Failure in ERC-20 when transfering token into the market.                                                                                                                                                        |
| 16   | TOKEN_TRANSFER_OUT_FAILED      | Failure in ERC-20 when transfering token out of the market.                                                                                                                                                      |
| 17   | UTILIZATION_ABOVE_MAX          | No more of this token can be borrowed right now.                                                                                                                                                                 |
| 10XX | DETAILED_COMPTROLLER_REJECTION | The action would violate the comptroller policy. To get more detail, subtract 1000 from the error code and use the difference as the enum index to lookup the [corresponding Comptroller error](#error-codes-2). |

### Failure Info

| Code | Name                                                       |
| ---- | ---------------------------------------------------------- |
| 0    | ACCEPT_ADMIN_PENDING_ADMIN_CHECK                           |
| 1    | ACCRUE_INTEREST_ACCUMULATED_INTEREST_CALCULATION_FAILED    |
| 2    | ACCRUE_INTEREST_BORROW_RATE_CALCULATION_FAILED             |
| 3    | ACCRUE_INTEREST_NEW_BORROW_INDEX_CALCULATION_FAILED        |
| 4    | ACCRUE_INTEREST_NEW_TOTAL_BORROWS_CALCULATION_FAILED       |
| 5    | ACCRUE_INTEREST_NEW_TOTAL_RESERVES_CALCULATION_FAILED      |
| 6    | ACCRUE_INTEREST_SIMPLE_INTEREST_FACTOR_CALCULATION_FAILED  |
| 7    | BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED              |
| 8    | BORROW_ACCRUE_INTEREST_FAILED                              |
| 9    | BORROW_CASH_NOT_AVAILABLE                                  |
| 10   | BORROW_FRESHNESS_CHECK                                     |
| 11   | BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED                |
| 12   | BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED       |
| 13   | BORROW_MARKET_NOT_LISTED                                   |
| 14   | BORROW_COMPTROLLER_REJECTION                               |
| 15   | LIQUIDATE_ACCRUE_BORROW_INTEREST_FAILED                    |
| 16   | LIQUIDATE_ACCRUE_COLLATERAL_INTEREST_FAILED                |
| 17   | LIQUIDATE_COLLATERAL_FRESHNESS_CHECK                       |
| 18   | LIQUIDATE_COMPTROLLER_REJECTION                            |
| 19   | LIQUIDATE_COMPTROLLER_CALCULATE_AMOUNT_SEIZE_FAILED        |
| 20   | LIQUIDATE_CLOSE_AMOUNT_IS_UINT_MAX                         |
| 21   | LIQUIDATE_CLOSE_AMOUNT_IS_ZERO                             |
| 22   | LIQUIDATE_FRESHNESS_CHECK                                  |
| 23   | LIQUIDATE_LIQUIDATOR_IS_BORROWER                           |
| 24   | LIQUIDATE_REPAY_BORROW_FRESH_FAILED                        |
| 25   | LIQUIDATE_SEIZE_BALANCE_INCREMENT_FAILED                   |
| 26   | LIQUIDATE_SEIZE_BALANCE_DECREMENT_FAILED                   |
| 27   | LIQUIDATE_SEIZE_COMPTROLLER_REJECTION                      |
| 28   | LIQUIDATE_SEIZE_LIQUIDATOR_IS_BORROWER                     |
| 29   | LIQUIDATE_SEIZE_TOO_MUCH                                   |
| 30   | MINT_ACCRUE_INTEREST_FAILED                                |
| 31   | MINT_COMPTROLLER_REJECTION                                 |
| 32   | MINT_EXCHANGE_CALCULATION_FAILED                           |
| 33   | MINT_EXCHANGE_RATE_READ_FAILED                             |
| 34   | MINT_FRESHNESS_CHECK                                       |
| 35   | MINT_NEW_ACCOUNT_BALANCE_CALCULATION_FAILED                |
| 36   | MINT_NEW_TOTAL_SUPPLY_CALCULATION_FAILED                   |
| 37   | MINT_TRANSFER_IN_FAILED                                    |
| 38   | MINT_TRANSFER_IN_NOT_POSSIBLE                              |
| 39   | REDEEM_ACCRUE_INTEREST_FAILED                              |
| 40   | REDEEM_COMPTROLLER_REJECTION                               |
| 41   | REDEEM_EXCHANGE_TOKENS_CALCULATION_FAILED                  |
| 42   | REDEEM_EXCHANGE_AMOUNT_CALCULATION_FAILED                  |
| 43   | REDEEM_EXCHANGE_RATE_READ_FAILED                           |
| 44   | REDEEM_FRESHNESS_CHECK                                     |
| 45   | REDEEM_NEW_ACCOUNT_BALANCE_CALCULATION_FAILED              |
| 46   | REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED                 |
| 47   | REDEEM_TRANSFER_OUT_NOT_POSSIBLE                           |
| 48   | REDUCE_RESERVES_ACCRUE_INTEREST_FAILED                     |
| 49   | REDUCE_RESERVES_ADMIN_CHECK                                |
| 50   | REDUCE_RESERVES_CASH_NOT_AVAILABLE                         |
| 51   | REDUCE_RESERVES_FRESH_CHECK                                |
| 52   | REDUCE_RESERVES_VALIDATION                                 |
| 53   | REPAY_BEHALF_ACCRUE_INTEREST_FAILED                        |
| 54   | REPAY_BORROW_ACCRUE_INTEREST_FAILED                        |
| 55   | REPAY_BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED        |
| 56   | REPAY_BORROW_COMPTROLLER_REJECTION                         |
| 57   | REPAY_BORROW_FRESHNESS_CHECK                               |
| 58   | REPAY_BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED |
| 59   | REPAY_BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED          |
| 60   | REPAY_BORROW_TRANSFER_IN_NOT_POSSIBLE                      |
| 61   | SET_COLLATERAL_FACTOR_OWNER_CHECK                          |
| 62   | SET_COLLATERAL_FACTOR_VALIDATION                           |
| 63   | SET_COMPTROLLER_OWNER_CHECK                                |
| 64   | SET_INTEREST_RATE_MODEL_ACCRUE_INTEREST_FAILED             |
| 65   | SET_INTEREST_RATE_MODEL_FRESH_CHECK                        |
| 66   | SET_INTEREST_RATE_MODEL_OWNER_CHECK                        |
| 67   | SET_MAX_ASSETS_OWNER_CHECK                                 |
| 68   | SET_ORACLE_MARKET_NOT_LISTED                               |
| 69   | SET_PENDING_ADMIN_OWNER_CHECK                              |
| 70   | SET_RESERVE_FACTOR_ACCRUE_INTEREST_FAILED                  |
| 71   | SET_RESERVE_FACTOR_ADMIN_CHECK                             |
| 72   | SET_RESERVE_FACTOR_FRESH_CHECK                             |
| 73   | SET_RESERVE_FACTOR_BOUNDS_CHECK                            |
| 74   | TRANSFER_COMPTROLLER_REJECTION                             |
| 75   | TRANSFER_NOT_ALLOWED                                       |
| 76   | TRANSFER_NOT_ENOUGH                                        |
| 77   | TRANSFER_TOO_MUCH                                          |
| 78   | ADD_RESERVES_ACCRUE_INTEREST_FAILED                        |
| 79   | ADD_RESERVES_FRESH_CHECK,                                  |
| 80   | ADD_RESERVES_TRANSFER_IN_NOT_POSSIBLE                      |

## Comptroller

The Comptroller is the risk management layer of the Fuse protocol; it determines how much collateral a user is required to maintain, and whether (and by how much) a user can be liquidated. Each time a user interacts with a fToken, the Comptroller is asked to approve or deny the transaction.

The Comptroller maps user balances to prices (via the Price Oracle) to risk weights (called [Collateral Factors](https://compound.finance/docs/comptroller#collateral-factor)) to make its determinations. Users explicitly list which assets they would like included in their risk scoring, by calling [Enter Markets](https://compound.finance/docs/comptroller#enter-markets) and [Exit Market](https://compound.finance/docs/comptroller#exit-market).

### Architecture

The Comptroller is implemented as an upgradeable proxy. The Unitroller proxies all logic to the Comptroller implementation, but storage values are set on the Unitroller. To call Comptroller functions, use the Comptroller ABI on the Unitroller address.

### Enter Markets

Enter into a list of markets - it is not an error to enter the same market more than once. In order to supply collateral or borrow in a market, it must be entered first.

```solidity
function enterMarkets(address[] calldata fTokens) returns (uint[] memory)
```

- `msg.sender`: The account which shall enter the given markets.
- `fTokens`: The addresses of the fToken markets to enter.
- `RETURN`: For each market, returns an error code indicating whether or not it was entered. Each is 0 on success, otherwise an [Error code](https://compound.finance/docs/comptroller#error-codes).

#### Solidity

```solidity
Comptroller troll = Comptroller(0xABCD...);

fToken[] memory fTokens = new fToken[](2);

fTokens[0] = fErc20(0x3FDA...);

fTokens[1] = fEther(0x3FDB...);

uint[] memory errors = troll.enterMarkets(fTokens);
```

#### Web3 1.0

```js
const troll = Comptroller.at(0xABCD...);

const fTokens = [fErc20.at(0x3FDA...), fEther.at(0x3FDB...)];

const errors = await troll.methods.enterMarkets(fTokens).send({from: ...});
```

### Exit Market

Exit a market - it is not an error to exit a market which is not currently entered. Exited markets will not count towards account liquidity calculations.

```solidity
function exitMarket(address fToken) returns (uint)
```

- `msg.sender`: The account which shall exit the given market.
- `fToken`: The addresses of the fToken market to exit.
- `RETURN`: 0 on success, otherwise an [Error code](https://compound.finance/docs/comptroller#error-codes).

#### Solidity

```solidity
Comptroller troll = Comptroller(0xABCD...);

uint error = troll.exitMarket(fToken(0x3FDA...));
```

#### Web3 1.0

```js
const troll = Comptroller.at(0xABCD...);

const errors = await troll.methods.exitMarket(fEther.at(0x3FDB...)).send({from: ...});
```

### Get Assets In

Get the list of markets an account is currently entered into. In order to supply collateral or borrow in a market, it must be entered first. Entered markets count towards [account liquidity](https://compound.finance/docs/comptroller#account-liquidity) calculations.

```solidity
function getAssetsIn(address account) view returns (address[] memory)
```

- `account`: The account whose list of entered markets shall be queried.
- `RETURN`: The address of each market which is currently entered into.

#### Solidity

```solidity
Comptroller troll = Comptroller(0xABCD...);

address[] memory markets = troll.getAssetsIn(0xMyAccount);
```

#### Web3 1.0

```js
const troll = Comptroller.at(0xABCD...);

const markets = await troll.methods.getAssetsIn(fTokens).call();
```

### Collateral Factor

A fToken's collateral factor can range from 0-90%, and represents the proportionate increase in liquidity (borrow limit) that an account receives by minting the fToken.

Generally, large or liquid assets have high collateral factors, while small or illiquid assets have low collateral factors. If an asset has a 0% collateral factor, it can't be used as collateral (or seized in liquidation), though it can still be borrowed.

Collateral factors can be increased (or decreased) by the pool creator.

```solidity
function markets(address fTokenAddress) view returns (bool, uint, bool)
```

- `fTokenAddress`: The address of the fToken to check if listed and get the collateral factor for.
- `RETURN:` Tuple of values (isListed, collateralFactorMantissa, isComped); isListed represents whether the comptroller recognizes this fToken; collateralFactorMantissa, scaled by 1e18, is multiplied by a supply balance to determine how much value can be borrowed.

#### Solidity

```solidity
Comptroller troll = Comptroller(0xABCD...);

(bool isListed, uint collateralFactorMantissa, bool isComped) = troll.markets(0x3FDA...);
```

#### Web3 1.0

```js
const troll = Comptroller.at(0xABCD...);

const result = await troll.methods.markets(0x3FDA...).call();

const {0: isListed, 1: collateralFactorMantissa, 2: isComped} = result;
```

### Get Account Liquidity

Account Liquidity represents the USD value borrowable by a user, before it reaches liquidation. Users with a shortfall (negative liquidity) are subject to liquidation, and can’t withdraw or borrow assets until Account Liquidity is positive again.

For each market the user has [entered](https://compound.finance/docs/comptroller#enter-markets) into, their supplied balance is multiplied by the market’s [collateral factor](https://compound.finance/docs/comptroller#collateral-factor), and summed; borrow balances are then subtracted, to equal Account Liquidity. Borrowing an asset reduces Account Liquidity for each USD borrowed; withdrawing an asset reduces Account Liquidity by the asset’s collateral factor times each USD withdrawn.

Because the Fuse Protocol exclusively uses unsigned integers, Account Liquidity returns either a surplus or shortfall.

```solidity
function getAccountLiquidity(address account) view returns (uint, uint, uint)
```

- `account`: The account whose liquidity shall be calculated.
- `RETURN`: Tuple of values (error, liquidity, shortfall). The error shall be 0 on success, otherwise an [error code](https://compound.finance/docs/comptroller#error-codes). A non-zero liquidity value indicates the account has available [account liquidity](https://compound.finance/docs/comptroller#account-liquidity). A non-zero shortfall value indicates the account is currently below his/her collateral requirement and is subject to liquidation. At most one of liquidity or shortfall shall be non-zero.

#### Solidity

```solidity
Comptroller troll = Comptroller(0xABCD...);

(uint error, uint liquidity, uint shortfall) = troll.getAccountLiquidity(msg.caller);

require(error == 0, "join the Discord");

require(shortfall == 0, "account underwater");

require(liquidity > 0, "account has excess collateral");
```

#### Web3 1.0

```js
const troll = Comptroller.at(0xABCD...);

const result = await troll.methods.getAccountLiquidity(0xBorrower).call();

const {0: error, 1: liquidity, 2: shortfall} = result;
```

### Close Factor

The percent, ranging from 0% to 100%, of a liquidatable account's borrow that can be repaid in a single liquidate transaction. If a user has multiple borrowed assets, the closeFactor applies to any single borrowed asset, not the aggregated value of a user’s outstanding borrowing.

```solidity
function closeFactorMantissa() view returns (uint)
```

- `RETURN`: The closeFactor, scaled by 1e18, is multiplied by an outstanding borrow balance to determine how much could be closed.

#### Solidity

```solidity
Comptroller troll = Comptroller(0xABCD...);

uint closeFactor = troll.closeFactorMantissa();
```

#### Web3 1.0

```js
const troll = Comptroller.at(0xABCD...);

const closeFactor = await troll.methods.closeFactorMantissa().call();
```

### Liquidation Incentive

The additional collateral given to liquidators as an incentive to perform liquidation of underwater accounts. For example, if the liquidation incentive is 1.1, liquidators receive an extra 10% of the borrowers collateral for every unit they close.

```solidity
function liquidationIncentiveMantissa() view returns (uint)
```

- `RETURN`: The liquidationIncentive, scaled by 1e18, is multiplied by the closed borrow amount from the liquidator to determine how much collateral can be seized.

#### Solidity

```solidity
Comptroller troll = Comptroller(0xABCD...);

uint closeFactor = troll.liquidationIncentiveMantissa();
```

#### Web3 1.0

```js
const troll = Comptroller.at(0xABCD...);

const closeFactor = await troll.methods.liquidationIncentiveMantissa().call();
```

### Key Events

| Event                                         | Description                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| MarketEntered(fToken fToken, address account) | Emitted upon a successful [Enter Market](https://compound.finance/docs/comptroller#enter-markets). |
| MarketExited(fToken fToken, address account)  | Emitted upon a successful [Exit Market](https://compound.finance/docs/comptroller#exit-market).    |

### Error Codes

| Code | Name                          | Description                                                                          |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------ |
| 0    | NO_ERROR                      | Not a failure.                                                                       |
| 1    | UNAUTHORIZED                  | The sender is not authorized to perform this action.                                 |
| 2    | COMPTROLLER_MISMATCH          | Liquidation cannot be performed in markets with different comptrollers.              |
| 3    | INSUFFICIENT_SHORTFALL        | The account does not have sufficient shortfall to perform this action.               |
| 4    | INSUFFICIENT_LIQUIDITY        | The account does not have sufficient liquidity to perform this action.               |
| 5    | INVALID_CLOSE_FACTOR          | The close factor is not valid.                                                       |
| 6    | INVALID_COLLATERAL_FACTOR     | The collateral factor is not valid.                                                  |
| 7    | INVALID_LIQUIDATION_INCENTIVE | The liquidation incentive is invalid.                                                |
| 8    | MARKET_NOT_ENTERED            | The market has not been entered by the account.                                      |
| 9    | MARKET_NOT_LISTED             | The market is not currently listed by the comptroller.                               |
| 10   | MARKET_ALREADY_LISTED         | An admin tried to list the same market more than once.                               |
| 11   | MATH_ERROR                    | A math calculation error occurred.                                                   |
| 12   | NONZERO_BORROW_BALANCE        | The action cannot be performed since the account carries a borrow balance.           |
| 13   | PRICE_ERROR                   | The comptroller could not obtain a required price of an asset.                       |
| 14   | REJECTION                     | The comptroller rejects the action requested by the market.                          |
| 15   | SNAPSHOT_ERROR                | The comptroller could not get the account borrows and exchange rate from the market. |
| 16   | TOO_MANY_ASSETS               | Attempted to enter more markets than are currently supported.                        |
| 17   | TOO_MUCH_REPAY                | Attempted to repay more than is allowed by the protocol.                             |
| 15   | SNAPSHOT_ERROR                | The comptroller could not get the account borrows and exchange rate from the market. |
| 16   | TOO_MANY_ASSETS               | Attempted to enter more markets than are currently supported.                        |
| 17   | TOO_MUCH_REPAY                | Attempted to repay more than is allowed by the protocol.                             |
| 18   | SUPPLIER_NOT_WHITELISTED      | The comptroller could not get the account borrows and exchange rate from the market. |
| 19   | BORROW_BELOW_MIN              | Attempted to enter borrow less than the maximum allowed amount.                      |
| 20   | SUPPLY_ABOVE_MAX              | Attempted to supply more than the maximum allowed amount.                            |

### Failure Info

| Code | Name                                        |
| ---- | ------------------------------------------- |
| 0    | ACCEPT_ADMIN_PENDING_ADMIN_CHECK            |
| 1    | ACCEPT_PENDING_IMPLEMENTATION_ADDRESS_CHECK |
| 2    | EXIT_MARKET_BALANCE_OWED                    |
| 3    | EXIT_MARKET_REJECTION                       |
| 4    | SET_CLOSE_FACTOR_OWNER_CHECK                |
| 5    | SET_CLOSE_FACTOR_VALIDATION                 |
| 6    | SET_COLLATERAL_FACTOR_OWNER_CHECK           |
| 7    | SET_COLLATERAL_FACTOR_NO_EXISTS             |
| 8    | SET_COLLATERAL_FACTOR_VALIDATION            |
| 9    | SET_COLLATERAL_FACTOR_WITHOUT_PRICE         |
| 10   | SET_IMPLEMENTATION_OWNER_CHECK              |
| 11   | SET_LIQUIDATION_INCENTIVE_OWNER_CHECK       |
| 12   | SET_LIQUIDATION_INCENTIVE_VALIDATION        |
| 13   | SET_MAX_ASSETS_OWNER_CHECK                  |
| 14   | SET_PENDING_ADMIN_OWNER_CHECK               |
| 15   | SET_PENDING_IMPLEMENTATION_OWNER_CHECK      |
| 16   | SET_PRICE_ORACLE_OWNER_CHECK                |
| 17   | SUPPORT_MARKET_EXISTS                       |
| 18   | SUPPORT_MARKET_OWNER_CHECK                  |
| 19   | SET_PAUSE_GUARDIAN_OWNER_CHECK              |
| 20   | UNSUPPORT_MARKET_OWNER_CHECK                |
| 21   | UNSUPPORT_MARKET_DOES_NOT_EXIST             |
| 22   | UNSUPPORT_MARKET_IN_USE                     |

## Fuse Pool Lens

### Return Value Glossary

#### fusePool
  <details close>
  <summary>values[]</summary>
  <ul><li>
  [0] <code>string name</code>: Name of the fuse pool
  <br></li><li>
  [1] <code>address creator</code>: Creator of the fuse pool 
  <br></li><li>
  [2] <code>address <a href="https://docs.rari.capital/fuse/#comptroller" >comptroller</code></a>: Comptroller of the fuse pool
  <br></li><li>
  [3] <code>uint256 blockPosted</code>:  Block in which pool created
  <br></li><li>
  [4] <code>uint256 timestampPosted</code>: Timestamp pool created
    </li></ul>
  </details>
#### fusePoolAsset
  <details close>
  <summary>values []</summary>
  <ul><li>
  [0] <code>address <a href="https://docs.rari.capital/fuse/#ftoken-s" >fToken</code></a>: Pool token address
  <br></li><li>
  [1] <code>address underlyingToken</code>: ERC20 deposited/withdrawn from this pool token 
  <br></li><li>
  [2] <code>string underlyingName</code>: Name of the token
  <br></li><li>
  [3] <code>string underlyingSymbol</code>: Symbol of the token
  <br></li><li>
  [4] <code>uint256 underlyingDecimals</code>: Decimals of token ($ETH is 18)
  <br></li><li>
  [5] <code>uint256 underlyingBalance</code>: Supply of underlying ERC20
  <br></li><li>
  [6] <code>uint256 <a href="https://docs.rari.capital/fuse/#supply-rate" >supplyRatePerBlock</code></a>: Supply interest in current block of token for the pool. Derived from borrow rate, reserve factor, and total borrows
  <br></li><li>
  [7]<code> uint256 borrowRatePerBlock</code>: Borrow interest rate of the current block
  <br></li><li>
  [8] <code>uint256 totalSupply</code>: Number of cToken in circulation 
  <br></li><li>
  [9]<code>uint256 totalBorrow</code>: Amount of underlying token being borrowed in pool
  <br></li><li>
  [10] <code>uint256 supplyBalance</code>: Total supply balance USD in pool 
  <br></li><li>
  [11]<code>uint256 borrowBalance</code>: Total borrow balance USD users in pool must repay including interest
  <br></li><li>
  [12] <code>uint256 liquidity</code>: USD value borrowable in pool
  <br></li><li>
  [13] <code>bool membership</code>: True if token is active in the pool
  <br></li><li>
  [14] <code> uint256 <a href="https://docs.rari.capital/fuse/#exchange-rate" >exchangeRate</code></a>: Number of underlying tokens that can be redeemed for fTokens
  <br></li><li>
  [15] <code>uint256 underlyingPrice</code>: Price of underlying tokens denominated in ETH 
  <br></li><li>
  [16] <code>address oracle</code>: Oracle from which this asset's price is fetched 
  <br></li><li>
  [17] <code>unt256 <a href="https://docs.rari.capital/fuse/#collateral-factor" >collareralFactor</code></a>: Represents the proportional(0-90%) increase in liquidity(borrow limit) that a supplying user gets for depositing this token
  <br></li><li>
  [18]<code>uint256 reserveFactor</code></a>: Proportion of borrow interest that is converted into [reserves](https://compound.finance/docs/ctokens#total-reserves)
  <br></li><li>
  [19] <code>uint256 adminFee</code>: Fee the pool admin takes on accrued interst 
  <br></li><li>
  [20] <code>uint256 fuseFee</code>: Fee the DAO takes on accrued interest
  </li></ul>
  </details>
#### fusePoolUser
  <details close>
  <summary>values []</summary>
  <ul><li>
  [0] <code>address account</code>: User's Ethereum address
  <br></li><li>
  [1] <code>uint256 <a href="https://docs.rari.capital/fuse/#total-borrow" >totalBorrow</code></a>: Total borrow balance of the pool user 
  <br></li><li>
  [2] <code>uint256 totalCollateral</code>: Total collateral of the user in the pool (USD)
  <br></li><li>
  [3] <code>uint256 health</code>: Total health of account in pool, collateral-borrow = health
  <br></li><li>
  [4] <code>tuple[] assets</code>: <a href="https://docs.rari.capital/fuse/#ftoken-s" >fTokens</a> supplied/borrowed by user in pool
  </li></ul>
  </details>

### Get Public Pools With Data

Gets all public fuse pools and metadata.

```solidity
function getPublicPoolsWithData() returns (uint256[], FusePool[], uint256[], uint256[], address[][], string[][], bool[])
```

`RETURN`: [ indexes[], [pools[]](#fusePool), totalSupply[], totalBorrow[], errored ]

#### Solidity

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

fusePool[] userPools = lens.getPublicPoolsWithData()
```

#### Web3 1.0

```js
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const Pools = await lens.methods.getPoolsByAccountWithData(0xEFGH);
```

### Get Pools By Account With Data

```solidity
function getPoolsByAccountWithData(address account) retruns (uint256[], tuple[], uint256[], uint256[], address[][], string[][], bool[])
```

- `account`: User address to parse for.
- `RETURN`: [ indexes[], [accountPools[]](#fusePool)), totalSupply[], totalBorrow[], errored ]

#### Solidity

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

poolData[] userPools = lens.getPoolsByAccountWithData(0xEFGH...) 
```

#### Web3 1.0

```js
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const usrPools = await lens.methods.getPoolsByAccountWithData(0xEFGH);
```

### Get Pool Summary

Gets metadata of a pool

```solidity
function getPoolSummary(address comptroller) returns (uint256, uint256, address[], string[])
```

- `Comptroller`: Pool to parse.
- `RETURN`: [ totalSupply, totalBorrow, underlyingTokens[], underlyingSymbol[] ]

#### Solidity

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

tuple[] poolInfo = lens.getPoolSummary(0xEFGH...); TODO
```

#### Web3 1.0

```js 
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const poolInfo = await lens.methods.getPoolSummary(0xEFGH...)
```

### Get Pool Assets With Data

Gets the tokens in a fuse pool

```solidity
function getPoolAssetsWithData(address Comptroller) returns (tuple[])
```

- `Comptroller`: Pool to parse.
- `RETURN`: [ [fusePoolAsset[]]("https://docs.rari.capital/fuse/#fusePoolAssetUser") ]

#### Solidity

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

FuseAsset[] assets = lens.getPoolAssetsWithData(0xEFGH...);
```

#### Web3 1.0

```js 
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const assets = await lens.methods.getPoolAssetsWithData(0xEFGH...);
```

### Get Public Pool Users With Data

Gets users and their data in a fuse pool under a given account health

```solidity
function getPoolUsersWithData(uint256 maxHealth) returns (address[], tuple[][], uint256[], uint256[], bool)
```

- `maxHealth`: maximum account health to parse for.
- `RETURN`: [ comptroller[], [fusePoolUser[]]("https://docs.rari.capital/fuse/#fusePoolUser"), closeFactor[], liquidationIncentive[], error]

#### Solidity

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

poolUser[] usrs = lens.getPublicPoolUsersWithData(101010...);
```

#### Web3 1.0

```js 
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const usrs = await lens.methods.getPublicPoolUsersWithData(101010...);
```

### Get Pool Users With Data

Gets users and their data in a fuse pool under a given account health

```solidity
function getPoolUsersWithData(address Comptroller, uint256 maxHealth) returns (tuple[], uint256, uint256)
```

- `Comptroller`: Pool to parse for.
- `maxHealth`: maximum account health to parse for.
- `RETURN`: [  [fusePoolUser[]]("https://docs.rari.capital/fuse/#fusePoolUser"), closeFactor,liquidationIncentive ]

#### Solidity

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

poolUsers usrs = lens.getPoolUsersWithData(0xEFGH..., 101010101010101010);
```

#### Web3 1.0

```js 
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const usrs = await lens.methods.getPoolUsersWithData(0xEFGH..., 101010101010101010);
```

### Get Pools By Supplier

gets pools that an address is supplying

~~~solidity
function getPoolsBySupplier(address account) returns (uint256[], tuple[])
~~~

- `account`: supplier account to parse pools for.
- `RETURN`: [index[], [fusePool[]](#fP)]

#### Solidity 

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

tuple[][] pools = lens.getPoolsBysupplier(0xEFGH...);
```

#### Web3 1.0

```js
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const pools = await lens.methods.getPoolsBySupplier(0xEFGH...);
```

### Get Pools By Supplier With Data

Gets pools that an address is supplying

```solidity
function getPoolsBySupplier(address account) returns (uint256[], tuple[], uint256[], uint256[], address[][], string[][], bool[])
```

- `account`: supplier account to parse pools for.
- `RETURN`: [indexes[], [pools[]]("https://docs.rari.capital/fuse/#fusePool"), totalSupply[], totalBorrow[], underlyingTokens[][], underlyingSymbols[][], errored[]]

#### Solidity 

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

tuple[][] pools = lens.getPoolsBysupplierWithData(0xEFGH...);
```

#### Web3 1.0

```js
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const usrs = await lens.methods.getPoolsBySupplierWithData(0xEFGH...);
```

### Get User Summary

Gets supply and borrow metadata for a user/account

```solidity
function getUserSummary(address account) returns (uint256, uint256, bool)
```

- `account`: account to parse for.
- `RETURN`: [supplyBalance, borrowBalance, error]

#### Solidity

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

tuple usr = lens.getUserSummary(0xEFGH...);
```

#### Web3 1.0

```js
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const usr = await lens.methods.getUserSummary(0xEFGH...);
```

### Get Pool User Summary

Gets supply and borrow metadata for a user/account in a pool

```solidity
function getPoolUserSummary(address comptroller, address account) returns (uint256, uint256)
```

- `comptroller`: pool comptroller address to parse for.
- `account`: user to parse for.
- `RETURN`: [supplyBalance, borrowBalance]

#### Solidity

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

tuple usr = lens.getPoolUserSummary(0xEFGH..., 0xIJKL...);
```

#### Web3 1.0

```js
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const usr = await lens.methods.getPoolUserSummary(0xEFGH..., 0xIJKL...);
```

### Get Whitelisted Pools By Account
Gets whitelisted pools an account is participating in
```solidity
function getWhitelistedPoolsByAccount(address account) returns (uint256[], tuple[])
```

- `account` : user to parse pools for. 
- `RETURN`: [indexes[], [pools[]]("https://docs.rari.capital/fuse/#fusePool") ]

#### Solidity

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

tuple[] pools = lens.getWhitelistedPoolsByAccount(0xEFGH...);
```

#### Web3 1.0

```js
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const pools = await lens.methods.getWhitelistedPoolsByAccount(0xEFGH...);
```

### Get Whitelisted Pools By Account With Data

Gets whitelisted pools an account is participating in with metadata

```solidity
function getWhitelistedPoolsByAccountWithData(address account) returns (uint256[], FusePool[], uint256[], uint256[], address[][], String[][], bool[])
```

- `account`: use to parse pools for.
- `RETURN`: [indexes[], [pools[]]("https://docs.rari.capital/fuse/#fusePool"), totalSupply[], totalBorrow[], underlyingTokens[][], underlyingSymbols[][], errored[] ]

#### Solidity

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

tuple[] pools = lens.getWhitelistedPoolsByAccountWithData(0xEFGH...);

```

#### Web3 1.0

```js
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const pools = await lens.methods.getWhitelistedPoolsByAccountWithData(0xEFGH...);
```


### Get Pool Ownership
```solidity
function getPoolOwnership(address Comptroller) returns (address, bool, bool, CTokenOwnership[])
```

- `comptroller`: pool comptroller address to parse for.
- `RETURN`: [compAdmin, compAdminHasRights, compFuseAdminHasRights, outliers].

#### Solidity

```solidity
fusePoolLens lens = fusePoolLens(0xABCD...);

ownerInfo = lens.getPoolOwnership(0xEFGH...);

```

#### Web3 1.0

```js
const lens = new Web3.eth.Contract(FUSE_POOL_LENS_ABI, 0xABCD...);

const pools = await lens.methods.getPoolOwnership(0xEFGH...);
```

## Fuse Safe Liquidator

### Safe Liquidate (c/fToken)

Self-funded-liquidate a fuse ERC20 position

```solidity
function safeLiquidate(address borrower, uint256 repayAmount, CErc20 cErc20, CToken cTokenCollateral, uint256 minOutputAmount, address exchangeSeizedTo)
```

- `borrower`: The borrower's Ethereum address.
- `repayAmount`: The amount to repay to liquidate the unhealthy loan.
- `cErc20`: The borrowed cErc20 to repay.
- `cTokenCollateral`: The cToken collateral to be liquidated.
- `minOutputAmount`: The minimum amount of collateral to seize (or the minimum exchange output if applicable) required for execution. Reverts if this condition is not met.
- `exchangeSeizedTo`: If set to an address other than `cTokenCollateral`, exchange seized collateral to this ERC20 token contract address (or the zero address for ETH).

#### Solidity

```solidity
fuseSafeLiquidator liq = fuseSafeLiquidator(0xABCD...);

liq.safeLiquidate(0xEFGH..., 010101..., cErc20, cTokenCollateral, 010101..., 0xHIJK...);
```

#### Web3 1.0

```js
const liq = new Web3.eth.Contract(FUSE_SAFE_LIQUIDATOR_ABI, 0xABCD...);

lens.methods.safeLiquidate(0xEFGH..., 010101..., cErc20, cTokenCollateral, 010101..., 0xHIJK...);
```

### Safe Liquidate (ETH)

Self-funded-liquidate a fuse ETH position

```solidity
 function safeLiquidate(address borrower, CEther cEther, CErc20 cErc20Collateral, uint256 minOutputAmount, address exchangeSeizedTo)
```

- `borrower`: The borrower's Ethereum address.
- `cEther`: The borrowed cEther contract to repay.
- `cErc20Collateral`: The cErc20 collateral contract to be liquidated.
- `minOutputAmount`: The minimum amount of collateral to seize (or the minimum exchange output if applicable) required for execution. Reverts if this condition is not met.
- `exchangeSeizedTo`: If set to an address other than `cTokenCollateral`, exchange seized collateral to this ERC20 token contract address (or the zero address for ETH).

#### Solidity 

```solidity
fuseSafeLiquidator liq = fuseSafeLiquidator(0xABCD...);

liq.safeLiquidate(0xEFGH..., cEther, cErc20Collateral, 010101..., 0xHIJK...);
```

#### Web 3 1.0

```js
const liq = new Web3.eth.Contract(FUSE_SAFE_LIQUIDATOR_ABI, 0xABCD...);

lens.methods.safeLiquidate(0xEFGH..., cEther, cErc20Collateral, 010101..., 0xHIJK...);
```

### Safe Liquidate To Tokens With Flash Loan(ERC20)

Flash-loan-funded liquidate a fuse ERC20 position

```solidity
function safeLiquidateToTokensWithFlashLoan(address borrower, uint256 repayAmount, CErc20 cErc20, CToken cTokenCollateral, uint256 minProfitAmount, address exchangeProfitTo)
```

- `borrower`: The borrower's Ethereum address.
- `repayAmount`: The amount to repay to liquidate the unhealthy loan.
- `cErc20`: The borrowed cErc20 to repay.
- `cTokenCollateral`: The cToken collateral to be liquidated.
- `minProfitAmount`: The minimum amount of profit required for execution (in terms of `exchangeProfitTo`). Reverts if this condition is not met.
- `exchangeProfitTo`: If set to an address other than `cTokenCollateral`, exchange seized collateral to this ERC20 token contract address (or the zero address for ETH).

#### Soldiity 

```soldity
fuseSafeLiquidator liq = fuseSafeLiquidator(0xABCD...);

liq.safeLiquidateToTokensWithFlashLoan(0xEFGH..., 010101..., cErc20, cTokenCollateral, 010101..., 0xHIJK...);
```

#### Web3 1.0 

```js
const liq = new Web3.eth.Contract(FUSE_SAFE_LIQUIDATOR_ABI, 0xABCD...);

lens.methods.safeLiquidateToTokensWithFlashLoan(0xEFGH..., 010101..., cErc20, cTokenCollateral, 010101..., 0xHIJK...);
```

### Safe Liquidate To ETH With Flash Loan

Flash-loan-funded liquidate a fuse ETH position

```solidity
function safeLiquidateToEthWithFlashLoan(address borrower, uint256 repayAmount, CEther cEther, CErc20 cErc20Collateral, uint256 minProfitAmount, address exchangeProfitTo)
```

- `borrower`: The borrower's Ethereum address.
- `repayAmount`: The amount to repay to liquidate the unhealthy loan.
- `cEther`: The borrowed cEther to repay.
- `cErc20Collateral`: The cErc20 collateral to be liquidated.
- `minProfitAmount`: The minimum amount of profit required for execution (in terms of `exchangeProfitTo`). Reverts if this condition is not met.
- `exchangeProfitTo`: If set to an address other than `cErc20Collateral`, exchange seized collateral to this ERC20 token contract address (or the zero address for ETH).

#### Solidity

```solidity
fuseSafeLiquidator liq = fuseSafeLiquidator(0xABCD...);

liq.safeLiquidateToEthWithFlashLoan(0xEFGH..., 010101..., cEther, cErc20Collateral, 010101..., 0xHIJK...);
```

#### Web3 1.0

```js
const liq = new Web3.eth.Contract(FUSE_SAFE_LIQUIDATOR_ABI, 0xABCD...);

lens.methods.safeLiquidateToEthWithFlashLoan(0xEFGH..., 010101..., cEther, cErc20Collateral, 010101..., 0xHIJK...);
```

### Uniswap V2 Call 
Note although this function is external, it is a callback for Uniswap Flashloans 


