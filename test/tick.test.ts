import { expect } from "chai";
import { Decimal } from "decimal.js";

import {
  getNearestTickByPrice,
  maxAmountB,
  MAX_TICK,
  MIN_TICK,
  sqrtPrice2Tick,
  tick2SqrtPrice,
} from "../src/math";

const MAX_SQRT_PRICE = new Decimal("4294027728.7238701638");
const MIN_SQRT_PRICE = new Decimal("2.3288158884274069273608478048194e-10");

describe("Tick", function () {
  describe("sqrtPrice2Tick", function () {
    it("1.0006001500200015 => 12", function () {
      expect(
        sqrtPrice2Tick(new Decimal("1.0006001500200015")).toString()
      ).to.equal("12");
    });
    it("MAX_SQRT_PRICE => MAX_TICK", function () {
      expect(sqrtPrice2Tick(MAX_SQRT_PRICE).toString()).to.equal(
        MAX_TICK.toString()
      );
    });
    it("0.3678978343771642 => -20000", function () {
      expect(
        sqrtPrice2Tick(new Decimal("0.3678978343771642")).toString()
      ).to.equal("-20000");
    });
    it("MIN_SQRT_PRICE => MIN_TICK", function () {
      expect(
        sqrtPrice2Tick(
          MIN_SQRT_PRICE.toDecimalPlaces(15, Decimal.ROUND_HALF_UP)
        ).toString()
      ).to.equal(MIN_TICK.toString());
    });
  });

  describe("tick2SqrtPrice", function () {
    it("20 => 1.001000450120021", function () {
      expect(tick2SqrtPrice(20).toDecimalPlaces(15).toString()).to.equal(
        "1.001000450120021"
      );
    });
    it("MAX_TICK => MAX_SQRT_PRICE", function () {
      expect(tick2SqrtPrice(MAX_TICK).toDecimalPlaces(10).toString()).to.equal(
        MAX_SQRT_PRICE.toString()
      );
    });
    it("-20000 => 0.367897834377124", function () {
      expect(
        tick2SqrtPrice(-20000)
          .toDecimalPlaces(15, Decimal.ROUND_HALF_UP)
          .toString()
      ).to.equal("0.367897834377124");
    });
    it("MIN_TICK => MIN_SQRT_PRICE", function () {
      expect(tick2SqrtPrice(MIN_TICK).toExponential(15).toString()).to.equal(
        MIN_SQRT_PRICE.toExponential(15).toString()
      );
    });
  });

  describe("", function () {
    it("60: 1 => 8", function () {
      expect(getNearestTickByPrice(new Decimal(1), 60)).to.equal(8);
    });
  });

  describe("liquity", function () {
    it("maxAmountA", function () {
      const amountA = maxAmountB(
        new Decimal(1),
        new Decimal(1.0001).pow(3446),
        new Decimal(100)
      );
      console.log(amountA);
    });
  });
});
