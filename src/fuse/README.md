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

```solidity
enum Error {
    NO_ERROR,
    UNAUTHORIZED,
    COMPTROLLER_MISMATCH,
    INSUFFICIENT_SHORTFALL,
    INSUFFICIENT_LIQUIDITY,
    INVALID_CLOSE_FACTOR,
    INVALID_COLLATERAL_FACTOR,
    INVALID_LIQUIDATION_INCENTIVE,
    MARKET_NOT_ENTERED, // no longer possible
    MARKET_NOT_LISTED,
    MARKET_ALREADY_LISTED,
    MATH_ERROR,
    NONZERO_BORROW_BALANCE,
    PRICE_ERROR,
    REJECTION,
    SNAPSHOT_ERROR,
    TOO_MANY_ASSETS,
    TOO_MUCH_REPAY,
    SUPPLIER_NOT_WHITELISTED,
    BORROW_BELOW_MIN,
    SUPPLY_ABOVE_MAX,
    NONZERO_TOTAL_SUPPLY
}
```

### Failure Info

```solidity
enum FailureInfo {
    ACCEPT_ADMIN_PENDING_ADMIN_CHECK,
    ACCEPT_PENDING_IMPLEMENTATION_ADDRESS_CHECK,
    EXIT_MARKET_BALANCE_OWED,
    EXIT_MARKET_REJECTION,
    RENOUNCE_ADMIN_RIGHTS_OWNER_CHECK,
    SET_CLOSE_FACTOR_OWNER_CHECK,
    SET_CLOSE_FACTOR_VALIDATION,
    SET_COLLATERAL_FACTOR_OWNER_CHECK,
    SET_COLLATERAL_FACTOR_NO_EXISTS,
    SET_COLLATERAL_FACTOR_VALIDATION,
    SET_COLLATERAL_FACTOR_WITHOUT_PRICE,
    SET_LIQUIDATION_INCENTIVE_OWNER_CHECK,
    SET_LIQUIDATION_INCENTIVE_VALIDATION,
    SET_MAX_ASSETS_OWNER_CHECK,
    SET_PENDING_ADMIN_OWNER_CHECK,
    SET_PENDING_IMPLEMENTATION_OWNER_CHECK,
    SET_PRICE_ORACLE_OWNER_CHECK,
    SET_WHITELIST_ENFORCEMENT_OWNER_CHECK,
    SET_WHITELIST_STATUS_OWNER_CHECK,
    SUPPORT_MARKET_EXISTS,
    SUPPORT_MARKET_OWNER_CHECK,
    SET_PAUSE_GUARDIAN_OWNER_CHECK,
    UNSUPPORT_MARKET_OWNER_CHECK,
    UNSUPPORT_MARKET_DOES_NOT_EXIST,
    UNSUPPORT_MARKET_IN_USE
}
```



## Comptroller

The Comptroller is the risk management layer of the Fuse protocol; it determines how much collateral a user is required to maintain, and whether (and by how much) a user can be liquidated. Each time a user interacts with a fToken, the Comptroller is asked to approve or deny the transaction.

The Comptroller maps user balances to prices (via the Price Oracle) to risk weights (called [Collateral Factors](https://compound.finance/docs/comptroller#collateral-factor)) to make its determinations. Users explicitly list which assets they would like included in their risk scoring, by calling [Enter Markets](https://compound.finance/docs/comptroller#enter-markets) and [Exit Market](https://compound.finance/docs/comptroller#exit-market).

## Architecture

The Comptroller is implemented as an upgradeable proxy. The Unitroller proxies all logic to the Comptroller implementation, but storage values are set on the Unitroller. To call Comptroller functions, use the Comptroller ABI on the Unitroller address.

## Enter Markets

Enter into a list of markets - it is not an error to enter the same market more than once. In order to supply collateral or borrow in a market, it must be entered first.

#### Comptroller

```
function enterMarkets(address[] calldata fTokens) returns (uint[] memory)
```

- msg.sender: The account which shall enter the given markets.
- fTokens: The addresses of the fToken markets to enter.
- RETURN: For each market, returns an error code indicating whether or not it was entered. Each is 0 on success, otherwise an [Error code](https://compound.finance/docs/comptroller#error-codes).

#### Solidity

```
Comptroller troll = Comptroller(0xABCD...);

fToken[] memory fTokens = new fToken[](2);

fTokens[0] = fErc20(0x3FDA...);

fTokens[1] = fEther(0x3FDB...);

uint[] memory errors = troll.enterMarkets(fTokens);
```

#### Web3 1.0

```
const troll = Comptroller.at(0xABCD...);

const fTokens = [fErc20.at(0x3FDA...), fEther.at(0x3FDB...)];

const errors = await troll.methods.enterMarkets(fTokens).send({from: ...});
```

## Exit Market

Exit a market - it is not an error to exit a market which is not currently entered. Exited markets will not count towards account liquidity calculations.

#### Comptroller

```
function exitMarket(address fToken) returns (uint)
```

- msg.sender: The account which shall exit the given market.
- fTokens: The addresses of the fToken market to exit.
- RETURN: 0 on success, otherwise an [Error code](https://compound.finance/docs/comptroller#error-codes).

#### Solidity

```
Comptroller troll = Comptroller(0xABCD...);

uint error = troll.exitMarket(fToken(0x3FDA...));
```

#### Web3 1.0

```
const troll = Comptroller.at(0xABCD...);

const errors = await troll.methods.exitMarket(fEther.at(0x3FDB...)).send({from: ...});
```

## Get Assets In

Get the list of markets an account is currently entered into. In order to supply collateral or borrow in a market, it must be entered first. Entered markets count towards [account liquidity](https://compound.finance/docs/comptroller#account-liquidity) calculations.

#### Comptroller

```
function getAssetsIn(address account) view returns (address[] memory)
```

- account: The account whose list of entered markets shall be queried.
- RETURN: The address of each market which is currently entered into.

#### Solidity

```
Comptroller troll = Comptroller(0xABCD...);

address[] memory markets = troll.getAssetsIn(0xMyAccount);
```

#### Web3 1.0

```
const troll = Comptroller.at(0xABCD...);

const markets = await troll.methods.getAssetsIn(fTokens).call();
```

## Collateral Factor

A fToken's collateral factor can range from 0-90%, and represents the proportionate increase in liquidity (borrow limit) that an account receives by minting the fToken.

Generally, large or liquid assets have high collateral factors, while small or illiquid assets have low collateral factors. If an asset has a 0% collateral factor, it can't be used as collateral (or seized in liquidation), though it can still be borrowed.

Collateral factors can be increased (or decreased) by the pool creator.

#### Comptroller

```
function markets(address fTokenAddress) view returns (bool, uint, bool)
```

- fTokenAddress: The address of the fToken to check if listed and get the collateral factor for.
- RETURN: Tuple of values (isListed, collateralFactorMantissa, isComped); isListed represents whether the comptroller recognizes this fToken; collateralFactorMantissa, scaled by 1e18, is multiplied by a supply balance to determine how much value can be borrowed. 

#### Solidity

```
Comptroller troll = Comptroller(0xABCD...);

(bool isListed, uint collateralFactorMantissa, bool isComped) = troll.markets(0x3FDA...);
```

#### Web3 1.0

```
const troll = Comptroller.at(0xABCD...);

const result = await troll.methods.markets(0x3FDA...).call();

const {0: isListed, 1: collateralFactorMantissa, 2: isComped} = result;
```

## Get Account Liquidity

Account Liquidity represents the USD value borrowable by a user, before it reaches liquidation. Users with a shortfall (negative liquidity) are subject to liquidation, and can’t withdraw or borrow assets until Account Liquidity is positive again.

For each market the user has [entered](https://compound.finance/docs/comptroller#enter-markets) into, their supplied balance is multiplied by the market’s [collateral factor](https://compound.finance/docs/comptroller#collateral-factor), and summed; borrow balances are then subtracted, to equal Account Liquidity. Borrowing an asset reduces Account Liquidity for each USD borrowed; withdrawing an asset reduces Account Liquidity by the asset’s collateral factor times each USD withdrawn.

Because the Fuse Protocol exclusively uses unsigned integers, Account Liquidity returns either a surplus or shortfall.

#### Comptroller

```
function getAccountLiquidity(address account) view returns (uint, uint, uint)
```

- account: The account whose liquidity shall be calculated.
- RETURN: Tuple of values (error, liquidity, shortfall). The error shall be 0 on success, otherwise an [error code](https://compound.finance/docs/comptroller#error-codes). A non-zero liquidity value indicates the account has available [account liquidity](https://compound.finance/docs/comptroller#account-liquidity). A non-zero shortfall value indicates the account is currently below his/her collateral requirement and is subject to liquidation. At most one of liquidity or shortfall shall be non-zero.

#### Solidity

```
Comptroller troll = Comptroller(0xABCD...);

(uint error, uint liquidity, uint shortfall) = troll.getAccountLiquidity(msg.caller);

require(error == 0, "join the Discord");

require(shortfall == 0, "account underwater");

require(liquidity > 0, "account has excess collateral");
```

#### Web3 1.0

```
const troll = Comptroller.at(0xABCD...);

const result = await troll.methods.getAccountLiquidity(0xBorrower).call();

const {0: error, 1: liquidity, 2: shortfall} = result;
```

## Close Factor

The percent, ranging from 0% to 100%, of a liquidatable account's borrow that can be repaid in a single liquidate transaction. If a user has multiple borrowed assets, the closeFactor applies to any single borrowed asset, not the aggregated value of a user’s outstanding borrowing.

#### Comptroller

```
function closeFactorMantissa() view returns (uint)
```

- RETURN: The closeFactor, scaled by 1e18, is multiplied by an outstanding borrow balance to determine how much could be closed.

#### Solidity

```
Comptroller troll = Comptroller(0xABCD...);

uint closeFactor = troll.closeFactorMantissa();
```

#### Web3 1.0

```
const troll = Comptroller.at(0xABCD...);

const closeFactor = await troll.methods.closeFactorMantissa().call();
```

## Liquidation Incentive

The additional collateral given to liquidators as an incentive to perform liquidation of underwater accounts. For example, if the liquidation incentive is 1.1, liquidators receive an extra 10% of the borrowers collateral for every unit they close.

#### Comptroller

```
function liquidationIncentiveMantissa() view returns (uint)
```

- RETURN: The liquidationIncentive, scaled by 1e18, is multiplied by the closed borrow amount from the liquidator to determine how much collateral can be seized.

#### Solidity

```
Comptroller troll = Comptroller(0xABCD...);

uint closeFactor = troll.liquidationIncentiveMantissa();
```

#### Web3 1.0

```
const troll = Comptroller.at(0xABCD...);

const closeFactor = await troll.methods.liquidationIncentiveMantissa().call();
```

## Key Events

| Event                                         | Description                                                  |
| --------------------------------------------- | ------------------------------------------------------------ |
| MarketEntered(fToken fToken, address account) | Emitted upon a successful [Enter Market](https://compound.finance/docs/comptroller#enter-markets). |
| MarketExited(fToken fToken, address account)  | Emitted upon a successful [Exit Market](https://compound.finance/docs/comptroller#exit-market). |

## Error Codes

| Code | Name                          | Description                                                  |
| ---- | ----------------------------- | ------------------------------------------------------------ |
| 0    | NO_ERROR                      | Not a failure.                                               |
| 1    | UNAUTHORIZED                  | The sender is not authorized to perform this action.         |
| 2    | COMPTROLLER_MISMATCH          | Liquidation cannot be performed in markets with different comptrollers. |
| 3    | INSUFFICIENT_SHORTFALL        | The account does not have sufficient shortfall to perform this action. |
| 4    | INSUFFICIENT_LIQUIDITY        | The account does not have sufficient liquidity to perform this action. |
| 5    | INVALID_CLOSE_FACTOR          | The close factor is not valid.                               |
| 6    | INVALID_COLLATERAL_FACTOR     | The collateral factor is not valid.                          |
| 7    | INVALID_LIQUIDATION_INCENTIVE | The liquidation incentive is invalid.                        |
| 8    | MARKET_NOT_ENTERED            | The market has not been entered by the account.              |
| 9    | MARKET_NOT_LISTED             | The market is not currently listed by the comptroller.       |
| 10   | MARKET_ALREADY_LISTED         | An admin tried to list the same market more than once.       |
| 11   | MATH_ERROR                    | A math calculation error occurred.                           |
| 12   | NONZERO_BORROW_BALANCE        | The action cannot be performed since the account carries a borrow balance. |
| 13   | PRICE_ERROR                   | The comptroller could not obtain a required price of an asset. |
| 14   | REJECTION                     | The comptroller rejects the action requested by the market.  |
| 15   | SNAPSHOT_ERROR                | The comptroller could not get the account borrows and exchange rate from the market. |
| 16   | TOO_MANY_ASSETS               | Attempted to enter more markets than are currently supported. |
| 17   | TOO_MUCH_REPAY                | Attempted to repay more than is allowed by the protocol.     |

## Failure Info

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