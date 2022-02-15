## Install:

```
npm i @cremafinance/crema-sdk
```

## Build:

```
npm run build
```

## Instructions:

```
import { TokenSwap } from '@cremafinance/crema-sdk'
const swap = await new TokenSwap(conn, swapProgramId, swapKey, null).load()
const amountOut: any = await swap.preSwapA(amountIn) // a->b
const amountOut: any = await swap.preSwapB(amountIn) // b->a
```

## Parameters Description：

```
amountIn: Decimal (using decimal.js repo)
```


## Liquidity Calculation Formula

Assuming the current price is $P_{c}$，the price range that users add liquidity in is $[P_{a},P_{b}]$

$
\LARGE
L = \begin {cases}
    ¦   {Δx} \over {1 \over {\sqrt{P_{a}}}} -  {1 \over {\sqrt{P_{b}}}} &, \text P_{c} < P_{a} \\    \
    ¦   {Δy} \over {\sqrt{P_{b}} - \sqrt{P_{a}}} &, \text P_{c} > P_{b}\\
    ¦   {{Δx} \over {1 \over {\sqrt{P_{c}}}} -  {1 \over {\sqrt{P_{b}}}}} = {{Δy} \over {\sqrt{P_{c}} - \sqrt{P_{a}}}} &, \text P_{c} \in [P_{a},P_{b}]  \\    \
    \end {cases}
$
