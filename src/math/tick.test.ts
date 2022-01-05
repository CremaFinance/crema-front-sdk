import { Decimal } from "decimal.js";
import { expect } from "chai";
import { sqrtPrice2Tick, tick2SqrtPrice } from "./tick";
import { getNearestTickByPrice, maxAmountB } from ".";

const MAX_TICK = 443636
const MIN_TICK = -MAX_TICK

describe('Tick', function () {
    describe('sqrtPrice2Tick', function () {
        it('1.0006001500200015 => 12', function () {
            expect(sqrtPrice2Tick(new Decimal('1.0006001500200015')).toString()).to.equal('12')
        })
        it('4294886577.209892 => 443636', function () {
            expect(sqrtPrice2Tick(new Decimal('4294886577.209892')).toString()).to.equal('443636')
        })
        it('0.3678978343771642 => -20000', function () {
            expect(sqrtPrice2Tick(new Decimal('0.3678978343771642')).toString()).to.equal('-20000')
        })
        it('2.32835019510489e-10 => -443636', function () {
            expect(sqrtPrice2Tick(new Decimal('2.32835019510489e-10')).toString()).to.equal('-443636')
        })
    })

    describe('tick2SqrtPrice', function () {
        it('20 => 1.001000450120021', function () {
            expect(tick2SqrtPrice(20).toDecimalPlaces(15).toString()).to.equal('1.001000450120021')
        })
        it('443636 => 4294886577.209892', function () {
            expect(tick2SqrtPrice(MAX_TICK).toDecimalPlaces(6).toString()).to.equal('4294886577.209892')
        })
        it('-20000 => 0.367897834377124', function () {
            expect(tick2SqrtPrice(-20000).toDecimalPlaces(15, Decimal.ROUND_HALF_UP).toString()).to.equal('0.367897834377124')
        })
        it('-443636 => 2.3283501951e-10', function () {
            expect(tick2SqrtPrice(MIN_TICK).toExponential(10)).to.equal('2.3283501951e-10')
        })
    })

    describe("", function () {
        it('60: 1 => 12', function () {
            expect(getNearestTickByPrice(new Decimal(1), 60)).to.equal(12)
        })
    })

    describe("liquity", function () {
        it('maxAmountA', function () {
            let amountA = maxAmountB(new Decimal(1), (new Decimal(1.0001)).pow(3446), new Decimal(100))
            console.log(amountA)
        })
    })
})