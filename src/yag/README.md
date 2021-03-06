# Yield Aggregator

The yield aggregator is Rari's product that enables anyone to instantly deposit a supported asset and receive an interest generating one.

## Overview

### R(X)PT (Rari (X) Pool Tokens)

Each user's share of a Rari Pool is represented by their R(X)PT (Rari (X) Pool Token) balance, an example being the Rari Stable Pool being represented by RSPT aka Rari Stable Pool Token. When you deposit funds to a Rari Pool, an equivalent amount (value-wise) of pool tokens is minted to your account. When you withdraw funds from the pool, the equivalent amount of value in the pool token is burned from your account. As soon as you deposit, you start earning yield. Essentially, Rari pool tokens holdings and yield are split up across the pool token holders proportionally to their balances.

### Deposits

Only certain stablecoins are accepted for direct deposits (direct meaning without exchange to an accepted currency). To deposit another currency, you must exchange your funds before depositing. Fortunately, Rari can exchange and deposit your funds in the same transaction via [0x](https://0x.org/) and/or [mStable](https://mstable.org/) (please be aware that exchanges via 0x are subject to slippage due to price spread as well as an ETH protocol fee, and exchanges via mStable are subject to a small denominational percentage fee, but can avoid slippage and even get you a bonus).

See Contract Usage section below for more information on how to deposit via the smart contracts and API section below for a detailed reference on the smart contract methods involved. See the Rari SDK for easy implementation and the web client for easy usage.

### Withdrawals

Only the stablecoins currently held by the Rari Stable Pool are available for direct withdrawals. To withdraw another currency, you must exchange your funds after withdrawing. Fortunately, Rari can withdraw and exchange your funds in the same transaction via [0x](https://0x.org/) and/or [mStable](https://mstable.org/) (please be aware that exchanges via 0x are subject to slippage due to price spread as well as an ETH protocol fee, and exchanges via mStable are subject to a small denominational percentage fee, but can avoid slippage and even get you a bonus).

See the Contract Usage section belowfor more information on how to withdraw via the smart contracts and API section below for a detailed reference on the smart contract methods involved. See the Rari SDK for easy implementation and the web client for easy usage.

### Structure

The Rari Stable Pool is composed of 5 user-facing **smart contracts** in total (see [`DEPLOYED.md`](https://github.com/Rari-Capital/rari-stable-pool-contracts/blob/master/DEPLOYED.md) for deployed addresses):

- `RariFundManager` is the Rari Stable Pool's main contract, handling deposits, withdrawals, USD balances, interest, fees, etc.
- `RariFundController` holds supplied funds and is used by the rebalancer to deposit and withdraw from pools and make exchanges.
- `RariFundToken` is the contract behind the Rari Stable Pool Token (RSPT), an ERC20 token used to internally account for the ownership of funds supplied to the Rari Stable Pool.
- `RariFundPriceConsumer` retrieves stablecoin prices from Chainlink's public price feeds (used by `RariFundManager` and `RariFundController`).
- `RariFundProxy` includes wrapper functions built on top of `RariFundManager`: exchange and deposit, withdraw and exchange, and deposit without paying gas via the Gas Station Network (GSN).

A **rebalancer** controls which pools hold which currencies at any given time but only has permission to move funds between pools and exchange currencies, not withdraw funds elsewhere.

### Security

Rari's Ethereum-based smart contracts are written in Solidity and audited by [Quantstamp](https://quantstamp.com/) (as well as various other partners) for security. Rari does not have control over your funds: instead, the Ethereum blockchain executes all secure code across its entire decentralized network (making it very difficult and extremely costly to rewrite history), and your funds are only withdrawable by you.

The rebalancer only has permission to move funds between pools and exchange currencies, not withdraw funds elsewhere. Losses due to exchange slippage in a 24-hour period are limited proportionally to the total supply for security since 0x orders can come from anywhere. However, the rebalancer can approve any amount of funds to the pools and exchanges integrated.

Please note that at the moment, smart contract upgrades are approved via a multisig federation controlled by various trusted parties. Each of the upgrades need to be voted on by governance at: vote.rari.capital for them to go live.

Please note that using our web client online at [app.rari.capital](https://app.rari.capital/) is not nearly as trustworthy as downloading, verifying, and using it offline. Lastly, the rebalancer can only rebalance funds to different pools and currencies (with limits on slippage).

## Contract Usage

The following document contains instructions on common usage of the Rari Stable Pool smart contracts' APIs.

- See API section below for a more detailed API reference on `RariFundController`, `RariFundManager`, `RariFundToken`, `RariFundPriceConsumer`, and `RariFundProxy`.
- See [EIP-20: ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20) for reference on all common functions of ERC20 tokens like RSPT.
- Smart contract ABIs are available in the `abi` properties of the JSON files in the `build` folder.

_If you're using JavaScript, don't waste your time directly integrating our smart contracts: the [Rari JavaScript SDK](https://github.com/Rari-Capital/rari-dApp/tree/master/src/rari-sdk) makes programmatic deposits and withdrawals as easy as just one line of code!_

### Stable Pool APY

- Get current raw APY (before fees):
  1. Get raw currency/subpool allocations (including unclaimed fees on interest): `(string[], uint256[], RariFundController.LiquidityPool[][], uint256[][], uint256[]) RariFundProxy.getRawFundBalancesAndPrices()` returns an array of currency codes, an array of corresponding fund controller contract balances for each currency code, an array of arrays of pool indexes for each currency code, an array of arrays of corresponding balances at each pool index for each currency code, and an array of prices in USD (scaled by 1e18) for each currency code.
  2. Multiply the APY of each pool of each currency by its fund controller balance (converted to USD).
  3. Divide the sum of these products by the sum of all fund controller contract balances and pool balances of each currency (converted to USD) to get the current Stable Pool APY.
- **Get current APY (after fees):** subtract the product of the current raw APY and `uint256 RariFundManager.getInterestFeeRate()` divided by 1e18 from the current raw Stable Pool APY.
- Get APY over time range (after fees):
  1. Get RSPT exchange rates at start and end of time range: divide `RariFundManager.getFundBalance()` by `RariFundToken.totalSupply()` to get the exchange rate of RSPT in USD (scaled by 1e18).
  2. Divide the ending exchange rate by the starting exchange rate, raise this quotient to the power of 1 year divided by the length of the time range, and subtract one to get the Stable Pool APY over this time range.

### My Balance and Interest

- **Get my USD balance supplied:** `uint256 RariFundManager.balanceOf(address account)` returns the total balance in USD (scaled by 1e18) supplied to the Rari Stable Pool by `account`.
- **Get my interest accrued:** Subtract total deposits and transfers in (in USD) and add total withdrawals and transfers out (in USD) from `uint256 RariFundManager.balanceOf(address account)`.

### Deposit

1. User chooses to deposit one of our directly supported tokens (DAI, USDC, USDT, TUSD, BUSD, and sUSD), ETH, or one of the tokens listed by the 0x swap tokens API (see [documentation](https://0x.org/docs/api#get-swapv0tokens) and [endpoint](https://api.0x.org/swap/v0/tokens)) in an amount no greater than the balance of their Ethereum account.

2. User calls `string[] RariFundManager.getAcceptedCurrencies()` to get an array of currency codes currently accepted for direct deposit to the Stable Pool.

   - If desired deposit currency is accepted:

     - Generally, user simply approves tokens and deposits them:

       1. User approves tokens to `RariFundManager` by calling `approve(address spender, uint256 amount)` on the ERC20 contract of the desired input token where `spender` is `RariFundManager` (to approve unlimited funds, set `amount` to `uint256(-1)`).
       2. Deposit with `bool RariFundManager.deposit(string currencyCode, uint256 amount)`

     - To avoid paying gas, if the user's Ethereum account has no past deposit, the deposit amount is >= 250 USD, and the ETH balance returned by

       ```solidity
       RelayHub(0xd216153c06e857cd7f72665e0af1d7d82172f494).balanceOf(0xb6b79d857858004bf475e4a57d4a446da4884866)
       ```

       is enough to cover the necessary gas, the user can submit their transaction via the Gas Station Network (GSN):

       1. User approves tokens to `RariFundProxy` by calling `approve(address spender, uint256 amount)` on the ERC20 contract of the desired input token where `spender` is `RariFundProxy` (to approve unlimited funds, set `amount` to `uint256(-1)`).

       2. To get the necessary approval data (a signature from our trusted signer allowing the user to use our ETH for gas), POST the JSON body

          ```js
          {
            from,
              to,
              encodedFunctionCall,
              txFee,
              gasPrice,
              gas,
              nonce,
              relayerAddress,
              relayHubAddress;
          }
          ```

          to

          ```
          https://app.rari.capital/checkSig.php
          ```

          - Note that `checkSig.php` may go offline at some point in the future, in which case the user should deposit normally as described above.

       3. User calls `bool RariFundProxy.deposit(string currencyCode, uint256 amount)` via the Gas Station Network (GSN).

   - If desired deposit currency is not accepted, get exchange data from mStable (preferably) and/or 0x:

     - If desired deposit currency is DAI, USDC, USDT, TUSD, or mUSD, until the user fulfills their entire deposit, exchange to any depositable currency among DAI, USDC, USDT, TUSD, or mUSD via mStable and deposit:

       1. Get exchange data from mStable:
          - If desired deposit currency is DAI, USDC, USDT, or TUSD, check `(bool, string, uint256, uint256) MassetValidationHelper(0xabcc93c3be238884cc3309c19afd128fafc16911).getMaxSwap(0xe2f2a5c287993345a840db3b0845fbc70f5935a5, address _input, address _output)`. If the first returned value is `true`, the user can exchange a maximum input amount of the third returned value.
          - If desired deposit currency is mUSD, check `(bool, string, uint256 output, uint256 bassetQuantityArg) MassetValidationHelper(0xabcc93c3be238884cc3309c19afd128fafc16911).getRedeemValidity(0xabcc93c3be238884cc3309c19afd128fafc16911, uint256 _mAssetQuantity, address _outputBasset)`. If the first returned value is `true`, the user can exchange a maximum input amount of `bassetQuantityArg` (the fourth returned value).
       2. User calls `bool RariFundProxy.exchangeAndDeposit(string inputCurrencyCode, uint256 inputAmount, string outputCurrencyCode)` to exchange and deposit.

     - If exchange via mStable is not possible (or if the user wants to exchange the rest of their deposit via 0x if mStable cannot exchange it all), retrieve order data from 0x:

       1. User retrieves data from 0x swap quote API (see [documentation](https://0x.org/docs/api#get-swapv0quote) and [endpoint](https://api.0x.org/swap/v0/quote?sellToken=DAI&buyToken=USDC&sellAmount=1000000000000000000)) where:

          - `sellToken` is their input currency
          - `buyToken` is a directly depositable currency to which the desired deposit currency will be exchanged
          - `sellAmount` is the input amount to be sent by the user

       2. User approves tokens to `RariFundProxy` by calling `approve(address spender, uint256 amount)` on the ERC20 contract of the desired input token where `spender` is `RariFundProxy` (to approve unlimited funds, set `amount` to `uint256(-1)`).

       3. User calls

          ```solidity
          bool RariFundProxy.exchangeAndDeposit(address inputErc20Contract, uint256 inputAmount, string outputCurrencyCode, LibOrder.Order[] orders, bytes[] signatures, uint256 takerAssetFillAmount)
          ```

          where:

          - `orders` is the orders array returned by the 0x API
          - `signatures` in an array of signatures from the orders array returned by the 0x API
          - `takerAssetFillAmount` is the input amount sent by the user

### Withdraw

1. User ensures that their account possesses enough USD (represented internally by RSPT) to make their withdrawal.
2. User calls `uint256 RariFundManager.getRawFundBalance(string currencyCode)` to get the raw total balance (currently held by the Stable Pool and available for direct withdrawal) of the desired withdrawal currency.
   - If the returned balance >= withdrawal amount, user calls `bool RariFundManager.withdraw(string currencyCode, uint256 amount)`
   - If returned balance < withdrawal amount:
     1. Until the whole withdrawal amount (including the directly withdrawable balance returned above) is filled, try to withdraw and exchange each of the other currencies held by the Stable Pool (DAI, USDC, USDT, TUSD, BUSD, sUSD, and mUSD) to the desired output currency:
        1. User calls `uint256 RariFundManager.getRawFundBalance(string currencyCode)` to get the raw total balance held by the Stable Pool of the potential input currency in question.
        2. Get exchange data from mStable (preferably) and/or 0x:
           - If output currency is DAI, USDC, USDT, TUSD, or mUSD, get exchange data via mStable:
             - If input currency is DAI, USDC, USDT, or TUSD, check `(bool, string, uint256, uint256) MassetValidationHelper(0xabcc93c3be238884cc3309c19afd128fafc16911).getMaxSwap(0xe2f2a5c287993345a840db3b0845fbc70f5935a5, address _input, address _output)`. If the first returned value is `true`, the user can exchange a maximum input amount of the third returned value.
             - If input currency is mUSD, check `(bool, string, uint256 output, uint256 bassetQuantityArg) MassetValidationHelper(0xabcc93c3be238884cc3309c19afd128fafc16911).getRedeemValidity(0xabcc93c3be238884cc3309c19afd128fafc16911, uint256 _mAssetQuantity, address _outputBasset)`. If the first returned value is `true`, the user can exchange a maximum input amount of `bassetQuantityArg` (the fourth returned value).
           - If exchange via mStable is not possible (or if the user wants to exchange additional funds via 0x if mStable cannot exchange it all), retrieve order data from 0x:
             - If the raw total balance of this input currency is enough to cover the remaining withdrawal amount, user retrieves data from the 0x swap quote API (see [documentation](https://0x.org/docs/api#get-swapv0quote) and [endpoint](https://api.0x.org/swap/v0/quote?sellToken=DAI&buyToken=USDC&sellAmount=1000000000000000000)) where:
               - `sellToken` is the input currency to be directly withdrawn from the Stable Pool
               - `buyToken` is the output currency to be sent to the user
               - `buyAmount` is the amount of output currency to be sent to the user in this exchange only
     2. User calls `bool RariFundProxy.withdrawAndExchange(string[] inputCurrencyCodes, uint256[] inputAmounts, address outputErc20Contract, LibOrder.Order[][] orders, bytes[][] signatures, uint256[] makerAssetFillAmounts, uint256[] protocolFees)` where:
        1. inputCurrencyCodes is an array of input currency codes
           1. To directly withdraw the output currency without exchange in the same transaction, simply include the output currency code in `inputCurrencyCodes`.
        2. `inputAmounts` is an array of input currency amounts
           1. To directly withdraw as much of the output currency without exchange in the same transaction, set the corresponding `inputAmounts` item to the directly withdrawable raw total balance of that currency.
        3. `outputErc20Contract` is the ERC20 token contract address of the output currency to be sent to the user
        4. `orders` is an array of orders arrays returned by the 0x API
           1. To exchange one of `inputCurrencyCodes` via mStable or to directly withdraw the output currency in the same transaction, set the corresponding `orders` item to an empty array.
        5. `signatures` is an array of arrays of signatures from the orders array returned by the 0x API
           1. To exchange one of `inputCurrencyCodes` via mStable or to directly withdraw the output currency in the same transaction, set the corresponding `signatures` item to an empty array.
        6. `makerAssetFillAmounts` is an array of output currency amounts to be sent to the user
           1. To exchange one of `inputCurrencyCodes` via mStable or to directly withdraw the output currency in the same transaction, set the corresponding `makerAssetFillAmounts` item to 0.
        7. `protocolFees` is an array of protocol fee amounts in ETH wei to be sent to 0x
           1. To exchange one of `inputCurrencyCodes` via mStable instead of 0x or to directly withdraw the output currency in the same transaction, set the corresponding `protocolFees` item to 0.

### RSPT (Rari Stable Pool Token)

### Introduction

Your RSPT (Rari Stable Pool Token) balance is a _token-based representation of your Rari Stable Pool balance._

- RSPT is minted to you when you deposit to the Stable Pool and redeemed (i.e., burned) when you withdraw from the Stable Pool.
- Accrued interest is constantly added to your USD balance supplied to the Stable Pool, meaning the USD value of your RSPT increases. However, your RSPT balance itself does not increase: instead, the exchange rate of RSPT increases at the same rate for every user as they accrue interest.
- When you transfer your RSPT, you transfer your holdings supplied to the Stable Pool (deposits + interest).

### Usage

- **Get RSPT exchange rate:** Divide `RariFundManager.getFundBalance()` by `RariFundToken.totalSupply()` to get the exchange rate of RSPT in USD (scaled by 1e18).
- **Get my RSPT balance (internal representation of my USD balance supplied):** `uint256 RariFundToken.balanceOf(address account)` returns the amount of RSPT owned by `account`.
- **Transfer RSPT:** `bool RariFundToken.transfer(address recipient, uint256 amount)` transfers `amount` RSPT to `recipient` (as with other ERC20 tokens like RSPT).
- **Approve RSPT:** `bool RariFundToken.approve(address spender, uint256 amount)` approves `spender` to spend the specified `amount` of RSPT on behalf of `msg.sender`
  - As with the `approve` functions of other ERC20 contracts, beware that changing an allowance with this method brings the risk that someone may use both the old and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards: https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
- See [EIP-20: ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20) for reference on all common functions of ERC20 tokens like RSPT.

### Total Supply & Interest

- **Get total USD supplied (by all users):** `uint256 RariFundManager.getFundBalance()` returns the total balance supplied by users to the Rari Stable Pool (all RSPT holders' funds but not unclaimed fees) in USD (scaled by 1e18).
- **Get total interest accrued (by all users):** `int256 RariFundManager.getInterestAccrued()` returns the total amount of interest accrued (excluding the fees paid on interest) by past and current Rari Stable Pool users (i.e., RSPT holders) in USD (scaled by 1e18).

### Fees

See [this Notion article](https://www.notion.so/Fees-e4689d7b800f485098548dd9e9d0a69f) for the latest fee-related information.

**Performance Fees**

- This fee is liable to change in the future, but the following method returns its current value at any time.
- Get interest fee rate: `uint256 RariFundManager.getInterestFeeRate()` returns the fee rate on interest (proportion of raw interest accrued scaled by 1e18).

**Withdrawal Fees**

- This fee is liable to change in the future, but the following method returns its current value at any time.
- Get withdrawal fee rate: `uint256 RariFundManager.getWithdrawalFeeRate()` returns the withdrawal fee rate (proportion of every withdrawal taken as a service fee scaled by 1e18).

### Raw Allocations

- **Get raw currency/subpool allocations (including unclaimed fees on interest) and prices:** `(string[], uint256[], RariFundController.LiquidityPool[][], uint256[][], uint256[]) RariFundProxy.getRawFundBalancesAndPrices()` returns an array of currency codes, an array of corresponding fund controller contract balances for each currency code, an array of arrays of pool indexes for each currency code, an array of arrays of corresponding balances at each pool index for each currency code, and an array of prices in USD (scaled by 1e18) for each currency code.

### Internal Stablecoin Pricing

- Get stablecoin prices (used internally by contracts): `uint256[] RariFundPriceConsumer.getCurrencyPricesInUsd()` returns an array of prices in USD (scaled by 1e18) for all supported stablecoins to which funds can be allocated (DAI, USDC, USDT, TUSD, BUSD, sUSD, and mUSD, in that order).
  - Use these prices to calculate the value added to a user's USD balance due to a direct deposit and the value subtracted from a user's USD balance due to a direct withdrawal.

## API

### User Balance and Interest

```solidity
uint256 RariFundManager.balanceOf(address account)
```

Returns the total balance in USD (scaled by 1e18) supplied to the Rari Stable Pool by `account`.

- Parameters:
  - `account` (address) - The account whose balance we are calculating.
- Development notes:
  - _Ideally, we can add the `view` modifier, but Compound's `getUnderlyingBalance` function (called by `getRawFundBalance`) potentially modifies the state._

### Deposits

```solidity
bool RariFundManager.isCurrencyAccepted(string currencyCode)
```

Returns a boolean indicating if deposits in `currencyCode` are currently accepted.

- Parameters:
  - `currencyCode` (string): The currency code to check.

```solidity
string[] RariFundManager.getAcceptedCurrencies()
```

Returns an array of currency codes currently accepted for deposits.

---

```solidity
RariFundProxy.deposit(string currencyCode, uint256 amount)
```

**_For the time being, we are no longer subsidizing gas fees._**

Deposits funds to the Rari Stable Pool in exchange for RSPT (with GSN support).

- You may only deposit currencies accepted by the fund (see `RariFundManager.isCurrencyAccepted(string currencyCode)`).
- Please note that you must approve RariFundProxy to transfer at least `amount`.
- Parameters:
  - `currencyCode` (string): The currency code of the token to be deposited.
  - `amount` (uint256): The amount of tokens to be deposited.

```solidity
RariFundManager.deposit(string currencyCode, uint256 amount)
```

Deposits funds to the Rari Stable Pool in exchange for RSPT.

- You may only deposit currencies accepted by the fund (see `RariFundManager.isCurrencyAccepted(string currencyCode)`). However, `RariFundProxy.exchangeAndDeposit` exchanges your funds via 0x and deposits them in one transaction.
- Please note that you must approve RariFundManager to transfer at least `amount`.
- Parameters:
  - `currencyCode` (string): The currency code of the token to be deposited.
  - `amount` (uint256): The amount of tokens to be deposited.

```solidity
RariFundProxy.exchangeAndDeposit(address inputErc20Contract, uint256 inputAmount, string outputCurrencyCode, LibOrder.Order[] orders, bytes[] signatures, uint256 takerAssetFillAmount)
```

Exchanges and deposits funds to the Rari Stable Pool in exchange for RSPT (via 0x).

- You can retrieve order data from the [0x swap API](https://0x.org/docs/api#get-swapv0quote). See the Contract Usage section above, the SDK, or the web client for implementation.
- Please note that you must approve RariFundProxy to transfer at least `inputAmount` unless you are inputting ETH.
- You also must input at least enough ETH to cover the protocol fee (and enough to cover `orders` if you are inputting ETH).
- Parameters:
  - `inputErc20Contract` (address): The ERC20 contract address of the token to be exchanged. Set to address(0) to input ETH.
  - `inputAmount` (uint256): The amount of tokens to be exchanged (including taker fees).
  - `outputCurrencyCode` (string): The currency code of the token to be deposited after exchange.
  - `orders` (LibOrder.Order[]): The limit orders to be filled in ascending order of the price you pay.
  - `signatures` (bytes[]): The signatures for the orders.
  - `takerAssetFillAmount` (uint256): The amount of the taker asset to sell (excluding taker fees).
- Development notes:
  - _We should be able to make this function external and use calldata for all parameters, but [Solidity does not support calldata structs](https://github.com/ethereum/solidity/issues/5479)._

```solidity
RariFundProxy.exchangeAndDeposit(string inputCurrencyCode, uint256 inputAmount, string outputCurrencyCode)
```

Exchanges and deposits funds to the Rari Stable Pool in exchange for RSPT (no slippage and low fees via mStable, but only supports DAI, USDC, USDT, TUSD, and mUSD).

- Please note that you must approve RariFundProxy to transfer at least `inputAmount`.
- Parameters:
  - `inputCurrencyCode` (string): The currency code of the token to be exchanged.
  - `inputAmount` (uint256): The amount of tokens to be exchanged (including taker fees).
  - `outputCurrencyCode` (string): The currency code of the token to be deposited after exchange.

### Withdrawals

```solidity
RariFundManager.withdraw(string currencyCode, uint256 amount)
```

Withdraws funds from the Rari Stable Pool in exchange for RSPT.

- You may only withdraw currencies held by the fund (see `RariFundManager.getRawFundBalance(string currencyCode)`). However, `RariFundProxy.withdrawAndExchange` withdraws your funds and exchanges them via 0x in one transaction.
- Please note that you must approve RariFundManager to burn of the necessary amount of RSPT.
- Parameters:
  - `currencyCode` (string): The currency code of the token to be withdrawn.
  - `amount` (uint256): The amount of tokens to be withdrawn.

```solidity
RariFundProxy.withdrawAndExchange(string[] inputCurrencyCodes, uint256[] inputAmounts, address outputErc20Contract, LibOrder.Order[][] orders, bytes[][] signatures, uint256[] makerAssetFillAmounts, uint256[] protocolFees)
```

Withdraws funds from the Rari Stable Pool in exchange for RSPT and exchanges to them to the desired currency (if no 0x orders are supplied, exchanges DAI, USDC, USDT, TUSD, and mUSD via mStable).

- You can retrieve order data from the [0x swap API](https://0x.org/docs/api#get-swapv0quote). See the Contract Usage section above, the SDK, or the web client for implementation.
- Please note that you must approve RariFundManager to burn of the necessary amount of RSPT. You also must input at least enough ETH to cover the protocol fees.
- Parameters:
  - `inputCurrencyCodes` (string[]): The currency codes of the tokens to be withdrawn and exchanged.
    - To directly withdraw the output currency without exchange in the same transaction, simply include the output currency code in `inputCurrencyCodes`.
  - `inputAmounts` (uint256[]): The amounts of tokens to be withdrawn and exchanged (including taker fees).
    - To directly withdraw as much of the output currency without exchange in the same transaction, set the corresponding `inputAmounts` item to the directly withdrawable raw fund balance of that currency.
  - `outputErc20Contract` (address): The ERC20 contract address of the token to be outputted by the exchange. Set to address(0) to output ETH.
  - `orders` (LibOrder.Order[][]): The 0x limit orders to be filled in ascending order of the price you pay.
    - To exchange one of `inputCurrencyCodes` via mStable or to directly withdraw the output currency in the same transaction, set the corresponding `orders` item to an empty array.
  - `signatures` (bytes[][]): The signatures for the 0x orders.
    - To exchange one of `inputCurrencyCodes` via mStable or to directly withdraw the output currency in the same transaction, set the corresponding `signatures` item to an empty array.
  - `makerAssetFillAmounts` (uint256[]): The amounts of the maker assets to buy.
    - To exchange one of `inputCurrencyCodes` via mStable or to directly withdraw the output currency in the same transaction, set the corresponding `makerAssetFillAmounts` item to 0.
  - `protocolFees` (uint256[]): The protocol fees to pay to 0x in ETH for each order.
    - To exchange one of `inputCurrencyCodes` via mStable instead of 0x or to directly withdraw the output currency in the same transaction, set the corresponding `protocolFees` item to 0.
- Development notes:
  - _We should be able to make this function external and use calldata for all parameters, but [Solidity does not support calldata structs](https://github.com/ethereum/solidity/issues/5479)._

### RSPT

See [EIP-20: ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20) for reference on all common functions of ERC20 tokens like RSPT. Here are a few of the most common ones:

```solidity
uint256 RariFundToken.balanceOf(address account)
```

Returns the amount of RSPT owned by `account`.

- A user's RSPT balance is an internal representation of their USD balance.
  - While a user's USD balance is constantly increasing as the Rari Stable Pool accrues interest, a user's RSPT balance does not change except on deposit, withdrawal, and transfer.
  - The price of RSPT is equivalent to the current value of the first \$1 USD deposited to the Rari Stable Pool.
- Parameters:
  - `account` (address) - The account whose balance we are retrieving.

```solidity
bool RariFundToken.transfer(address recipient, uint256 amount)
```

Transfers the specified `amount` of RSPT to `recipient`.

- Parameters:
  - `recipient` (address): The recipient of the RSPT.
  - `inputAmounts` (uint256[]): The amounts of tokens to be withdrawn and exchanged (including taker fees).
- `RETURN` value: Boolean indicating success.

```solidity
bool RariFundToken.approve(address spender, uint256 amount)
```

Approve `sender` to spend the specified `amount` of RSPT on behalf of `msg.sender`.

- As with the `approve` functions of other ERC20 contracts, beware that changing an allowance with this method brings the risk that someone may use both the old and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards: https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
- Parameters:
  - `spender` (address) - The account to which we are setting an allowance.
  - `amount` (uint256) - The amount of the allowance to be set.
- `RETURN` value: Boolean indicating success.

```solidity
uint256 RariFundToken.totalSupply()
```

Returns the total supply of RSPT (scaled by 1e18).

- Divide `RariFundManager.getFundBalance()` by `RariFundToken.totalSupply()` to get the exchange rate of RSPT in USD (scaled by 1e18).

### Total Supply and Interest

```solidity
uint256 RariFundManager.getFundBalance()
```

Returns the total balance supplied by users to the Rari Stable Pool (all RSPT holders' funds but not unclaimed fees) in USD (scaled by 1e18).

- Development notes:
  - _Ideally, we can add the `view` modifier, but Compound's `getUnderlyingBalance` function (called by `getRawFundBalance`) potentially modifies the state._

```solidity
int256 RariFundManager.getInterestAccrued()
```

Returns the total amount of interest accrued (excluding the fees paid on interest) by past and current Rari Stable Pool users (i.e., RSPT holders) in USD (scaled by 1e18).

- Development notes:
  - _Ideally, we can add the `view` modifier, but Compound's `getUnderlyingBalance` function (called by `getRawFundBalance`) potentially modifies the state._

### Fees

```solidity
uint256 RariFundManager.getInterestFeeRate()
```

Returns the fee rate on interest (proportion of raw interest accrued scaled by 1e18).

```solidity
int256 RariFundManager.getInterestFeesGenerated()
```

Returns the amount of interest fees accrued by beneficiaries in USD (scaled by 1e18).

- Development notes:
  - _Ideally, we can add the `view` modifier, but Compound's `getUnderlyingBalance` function (called by `getRawFundBalance`) potentially modifies the state._

```solidity
uint256 RariFundManager.getWithdrawalFeeRate()
```

Returns the withdrawal fee rate (proportion of every withdrawal taken as a service fee scaled by 1e18).

### Raw Total Supply, Allocations, and Interest

```solidity
uint256 RariFundManager.getRawFundBalance()
```

Returns the raw total balance of the Rari Stable Pool (all RSPT holders' funds + all unclaimed fees) of all currencies in USD (scaled by 1e18).

- Development notes:
  - _Ideally, we can add the `view` modifier, but Compound's `getUnderlyingBalance` function (called by `getRawFundBalance`) potentially modifies the state._

```solidity
uint256 RariFundManager.getRawFundBalance(string currencyCode)
```

Returns the raw total balance of the Rari Stable Pool (all RSPT holders' funds + all unclaimed fees) of the specified currency.

- Parameters:
  - `currencyCode` (string): The currency code of the balance to be calculated.
- Development notes:
  - _Ideally, we can add the `view` modifier, but Compound's `getUnderlyingBalance` function (called by `RariFundController.getPoolBalance`) potentially modifies the state._

```solidity
(string[], uint256[], RariFundController.LiquidityPool[][], uint256[][], uint256[]) RariFundProxy.getRawFundBalancesAndPrices()
```

Returns the fund controller's contract balance of each currency, balance of each pool of each currency (checking `_poolsWithFunds` first to save gas), and price of each currency.

- `RETURN` values: An array of currency codes, an array of corresponding fund controller contract balances for each currency code, an array of arrays of pool indexes for each currency code, an array of arrays of corresponding balances at each pool index for each currency code, and an array of prices in USD (scaled by 1e18) for each currency code.
- Development notes:
  - _Ideally, we can add the `view` modifier, but Compound's `getUnderlyingBalance` function (called by `getPoolBalance`) potentially modifies the state._

```solidity
int256 RariFundManager.getRawInterestAccrued()
```

Returns the raw total amount of interest accrued by the Rari Stable Pool (including the fees paid on interest) in USD (scaled by 1e18).

- Development notes:
  - _Ideally, we can add the `view` modifier, but Compound's `getUnderlyingBalance` function (called by `getRawFundBalance`) potentially modifies the state._

### Internal Stablecoin Pricing

```solidity
uint256[] RariFundPriceConsumer.getCurrencyPricesInUsd()
```

Returns the prices of all supported stablecoins to which funds can be allocated.

- Use these prices to calculate the value added to a user's USD balance due to a direct deposit and the value subtracted from a user's USD balance due to a direct withdrawal.
- `RETURN` value: An array of prices in USD (scaled by 1e18) corresponding to the following list of currencies in the following order: DAI, USDC, USDT, TUSD, BUSD, sUSD, and mUSD.
