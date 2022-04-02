import assert from "assert";
import BN from "bn.js";
import { expect } from "chai";
import Decimal from "decimal.js";

import { DecimalExt } from "./decimalExt";

const MAX_64 = "9223372036854775807";
const MIN_64 = "-9223372036854775808";
const MAX_U64 = "18446744073709551615";
const MAX_U128 = "340282366920938463463374607431768211455";
const MAX_128 = "170141183460469231731687303715884105727";
const MIN_128 = "-170141183460469231731687303715884105728";
const MIN_128_BUF = Buffer.from([
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128,
]);

export class Numberu64 extends BN {
  toBuffer(): Buffer {
    return super.toBuffer("le", 8);
  }
  static fromBuffer(buffer: Buffer): Numberu64 {
    assert(buffer.length === 8, `Invalid buffer length: ${buffer.length}`);
    return new BN(buffer, 8, "le");
  }
}

export class Number128 extends BN {
  toBuffer(): Buffer {
    if (super.isNeg()) {
      const buffer = super.add(new BN(1)).toBuffer("le", 16);
      buffer.forEach(function (item, index, input) {
        input[index] = ~item & 0xff;
      });
      return buffer;
    } else {
      return super.toBuffer("le", 16);
    }
  }
  static fromBuffer(buffer: Buffer): Number128 {
    return buffer[15] > 0x80
      ? new BN(
          [...buffer]
            .map((i) => `00${Math.abs(~i & 0xff).toString(16)}`.slice(-2))
            .join(""),
          16,
          "le"
        )
          .add(new BN(1))
          .neg()
      : new BN(buffer, 16, "le");
  }
}

export class Numberu128 extends BN {
  toBuffer(): Buffer {
    return super.toBuffer("le", 16);
  }
  static fromBuffer(buffer: Buffer): Numberu128 {
    assert(buffer.length === 16, `Invalid buffer length: ${buffer.length}`);
    return new BN(buffer, 16, "le");
  }
}

describe("DecimalExt", function () {
  it("from64Buffer", function () {
    expect(
      DecimalExt.from64Buffer(new BN("0").toBuffer("le", 8)).toString()
    ).to.equal("0");
    expect(
      DecimalExt.from64Buffer(new BN("1").toBuffer("le", 8)).toString()
    ).to.equal("1");
    expect(
      DecimalExt.from64Buffer(new BN("100").toBuffer("le", 8)).toString()
    ).to.equal("100");
    expect(
      DecimalExt.from64Buffer(new BN("1000").toBuffer("le", 8)).toString()
    ).to.equal("1000");
    expect(
      DecimalExt.from64Buffer(new BN("10000").toBuffer("le", 8)).toString()
    ).to.equal("10000");
    expect(
      DecimalExt.from64Buffer(new BN("1000000").toBuffer("le", 8)).toString()
    ).to.equal("1000000");
    expect(
      DecimalExt.from64Buffer(new BN("100000000").toBuffer("le", 8)).toString()
    ).to.equal("100000000");
    expect(
      DecimalExt.from64Buffer(
        new BN("10000000000").toBuffer("le", 8)
      ).toString()
    ).to.equal("10000000000");
    expect(
      DecimalExt.from64Buffer(
        new BN("100000000000000").toBuffer("le", 8)
      ).toString()
    ).to.equal("100000000000000");
    expect(
      DecimalExt.from64Buffer(
        new BN("12345678987654321").toBuffer("le", 8)
      ).toString()
    ).to.equal("12345678987654321");
    expect(
      DecimalExt.from64Buffer(
        new BN("12345678987654321").toBuffer("le", 8),
        5
      ).toString()
    ).to.equal("123456789876.54321");
    expect(
      DecimalExt.from64Buffer(new BN(MAX_64).toBuffer("le", 8)).toString()
    ).to.equal(MAX_64);
    expect(
      DecimalExt.from64Buffer(new BN(MIN_64).toBuffer("le", 8)).toString()
    ).to.equal(MIN_64);
  });
  it("to64Buffer", function () {
    expect(DecimalExt.to64Buffer(new Decimal("0")).toString()).to.equal(
      new BN("0").toBuffer("le", 8).toString()
    );
    expect(DecimalExt.to64Buffer(new Decimal("1")).toString()).to.equal(
      new BN("1").toBuffer("le", 8).toString()
    );
    expect(DecimalExt.to64Buffer(new Decimal("10")).toString()).to.equal(
      new BN("10").toBuffer("le", 8).toString()
    );
    expect(DecimalExt.to64Buffer(new Decimal("1000")).toString()).to.equal(
      new BN("1000").toBuffer("le", 8).toString()
    );
    expect(DecimalExt.to64Buffer(new Decimal("1000000")).toString()).to.equal(
      new BN("1000000").toBuffer("le", 8).toString()
    );
    expect(
      DecimalExt.to64Buffer(new Decimal("1000000000000")).toString()
    ).to.equal(new BN("1000000000000").toBuffer("le", 8).toString());
    expect(
      DecimalExt.to64Buffer(new Decimal("12345678987654321")).toString()
    ).to.equal(new BN("12345678987654321").toBuffer("le", 8).toString());
    expect(DecimalExt.to64Buffer(new Decimal(MAX_64)).toString()).to.equal(
      new BN(MAX_64).toBuffer("le", 8).toString()
    );

    const min64Buffer = Buffer.from([0, 0, 0, 0, 0, 0, 0, 128]);
    expect(DecimalExt.to64Buffer(new Decimal(MIN_64)).toString()).to.equal(
      min64Buffer.toString()
    );
  });

  it("fromU64Buffer", function () {
    expect(
      DecimalExt.fromU64Buffer(new Numberu64("0").toBuffer()).toString()
    ).to.equal("0");
    expect(
      DecimalExt.fromU64Buffer(new Numberu64("1").toBuffer()).toString()
    ).to.equal("1");
    expect(
      DecimalExt.fromU64Buffer(new Numberu64("100").toBuffer()).toString()
    ).to.equal("100");
    expect(
      DecimalExt.fromU64Buffer(new Numberu64("1000").toBuffer()).toString()
    ).to.equal("1000");
    expect(
      DecimalExt.fromU64Buffer(new Numberu64("10000").toBuffer()).toString()
    ).to.equal("10000");
    expect(
      DecimalExt.fromU64Buffer(new Numberu64("1000000").toBuffer()).toString()
    ).to.equal("1000000");
    expect(
      DecimalExt.fromU64Buffer(new Numberu64("100000000").toBuffer()).toString()
    ).to.equal("100000000");
    expect(
      DecimalExt.fromU64Buffer(
        new Numberu64("10000000000").toBuffer()
      ).toString()
    ).to.equal("10000000000");
    expect(
      DecimalExt.fromU64Buffer(
        new Numberu64("100000000000000").toBuffer()
      ).toString()
    ).to.equal("100000000000000");
    expect(
      DecimalExt.fromU64Buffer(
        new Numberu64("12345678987654321").toBuffer()
      ).toString()
    ).to.equal("12345678987654321");
    expect(
      DecimalExt.fromU64Buffer(new Numberu64(MAX_U64).toBuffer()).toString()
    ).to.equal(MAX_U64);

    expect(
      DecimalExt.fromU64Buffer(
        new Numberu64("10000000000").toBuffer(),
        10
      ).toString()
    ).to.equal("1");
    expect(
      DecimalExt.fromU64Buffer(
        new Numberu64("100000000000000").toBuffer(),
        10
      ).toString()
    ).to.equal("10000");

    expect(
      DecimalExt.fromU64Buffer(
        new Numberu64("10000000000").toBuffer(),
        -4
      ).toString()
    ).to.equal("100000000000000");
    expect(
      DecimalExt.fromU64Buffer(
        new Numberu64("100000000000000").toBuffer(),
        -10
      ).toString()
    ).to.equal("1000000000000000000000000");

    //expect(DecimalExt.fromU64Buffer(new Numberu128(MAX_U64).toBuffer()).toString()).to.be. ("Error: Invariant failed: Invalid buffer length: 16")
  });

  it("toU64Buffer", function () {
    expect(DecimalExt.toU64Buffer(new Decimal("0")).toString()).to.equal(
      new Numberu64("0").toBuffer().toString()
    );
    expect(DecimalExt.toU64Buffer(new Decimal("1")).toString()).to.equal(
      new Numberu64("1").toBuffer().toString()
    );
    expect(DecimalExt.toU64Buffer(new Decimal("10")).toString()).to.equal(
      new Numberu64("10").toBuffer().toString()
    );
    expect(DecimalExt.toU64Buffer(new Decimal("1000")).toString()).to.equal(
      new Numberu64("1000").toBuffer().toString()
    );
    expect(DecimalExt.toU64Buffer(new Decimal("1000000")).toString()).to.equal(
      new Numberu64("1000000").toBuffer().toString()
    );
    expect(
      DecimalExt.toU64Buffer(new Decimal("1000000000000")).toString()
    ).to.equal(new Numberu64("1000000000000").toBuffer().toString());
    expect(
      DecimalExt.toU64Buffer(new Decimal("12345678987654321")).toString()
    ).to.equal(new Numberu64("12345678987654321").toBuffer().toString());
    expect(DecimalExt.toU64Buffer(new Decimal(MAX_U64)).toString()).to.equal(
      new Numberu64(MAX_U64).toBuffer().toString()
    );

    expect(
      DecimalExt.toU64Buffer(new Decimal("1000000"), 4).toString()
    ).to.equal(new Numberu64("10000000000").toBuffer().toString());
    expect(
      DecimalExt.toU64Buffer(new Decimal("1000000"), 10).toString()
    ).to.equal(new Numberu64("10000000000000000").toBuffer().toString());

    expect(
      DecimalExt.toU64Buffer(new Decimal("1000000"), -4).toString()
    ).to.equal(new Numberu64("100").toBuffer().toString());
    expect(
      DecimalExt.toU64Buffer(new Decimal("100000000000"), -10).toString()
    ).to.equal(new Numberu64("10").toBuffer().toString());
  });

  it("from128Buffer", function () {
    expect(
      DecimalExt.from128Buffer(new Number128("0").toBuffer()).toString()
    ).to.equal("0");
    expect(
      DecimalExt.from128Buffer(new Number128("1").toBuffer()).toString()
    ).to.equal("1");
    expect(
      DecimalExt.from128Buffer(new Number128("100").toBuffer()).toString()
    ).to.equal("100");
    expect(
      DecimalExt.from128Buffer(new Number128("1000").toBuffer()).toString()
    ).to.equal("1000");
    expect(
      DecimalExt.from128Buffer(new Number128("10000").toBuffer()).toString()
    ).to.equal("10000");
    expect(
      DecimalExt.from128Buffer(new Number128("1000000").toBuffer()).toString()
    ).to.equal("1000000");
    expect(
      DecimalExt.from128Buffer(new Number128("100000000").toBuffer()).toString()
    ).to.equal("100000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("10000000000").toBuffer()
      ).toString()
    ).to.equal("10000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("100000000000000").toBuffer()
      ).toString()
    ).to.equal("100000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("10000000000000000000000").toBuffer()
      ).toString()
    ).to.equal("10000000000000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("100000000000000000000000000").toBuffer()
      ).toString()
    ).to.equal("100000000000000000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("10000000000000000000000000000000000").toBuffer()
      ).toString()
    ).to.equal("10000000000000000000000000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("100000000000000").toBuffer()
      ).toString()
    ).to.equal("100000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("123456789876543212345678987654321").toBuffer()
      ).toString()
    ).to.equal("123456789876543212345678987654321");
    expect(
      DecimalExt.from128Buffer(new Number128("-1").toBuffer()).toString()
    ).to.equal("-1");
    expect(
      DecimalExt.from128Buffer(new Number128("-100").toBuffer()).toString()
    ).to.equal("-100");
    expect(
      DecimalExt.from128Buffer(new Number128("-1000").toBuffer()).toString()
    ).to.equal("-1000");
    expect(
      DecimalExt.from128Buffer(new Number128("-10000").toBuffer()).toString()
    ).to.equal("-10000");
    expect(
      DecimalExt.from128Buffer(new Number128("-1000000").toBuffer()).toString()
    ).to.equal("-1000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-100000000").toBuffer()
      ).toString()
    ).to.equal("-100000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-10000000000").toBuffer()
      ).toString()
    ).to.equal("-10000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-100000000000000").toBuffer()
      ).toString()
    ).to.equal("-100000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-10000000000000000000000").toBuffer()
      ).toString()
    ).to.equal("-10000000000000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-100000000000000000000000000").toBuffer()
      ).toString()
    ).to.equal("-100000000000000000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-10000000000000000000000000000000000").toBuffer()
      ).toString()
    ).to.equal("-10000000000000000000000000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-100000000000000").toBuffer()
      ).toString()
    ).to.equal("-100000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-123456789876543212345678987654321").toBuffer()
      ).toString()
    ).to.equal("-123456789876543212345678987654321");
    expect(
      DecimalExt.from128Buffer(new Number128(MAX_128).toBuffer()).toString()
    ).to.equal(MAX_128);
    expect(DecimalExt.from128Buffer(MIN_128_BUF).toString()).to.equal(MIN_128);
    expect(
      DecimalExt.from128Buffer(
        new Number128("10000000000").toBuffer(),
        10
      ).toString()
    ).to.equal("1");
    expect(
      DecimalExt.from128Buffer(
        new Number128("100000000000000").toBuffer(),
        10
      ).toString()
    ).to.equal("10000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("123456789876543212345678987654321").toBuffer(),
        10
      ).toString()
    ).to.equal("12345678987654321234567.8987654321");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-10000000000").toBuffer(),
        10
      ).toString()
    ).to.equal("-1");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-100000000000000").toBuffer(),
        10
      ).toString()
    ).to.equal("-10000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-123456789876543212345678987654321").toBuffer(),
        10
      ).toString()
    ).to.equal("-12345678987654321234567.8987654321");
    expect(
      DecimalExt.from128Buffer(
        new Number128("10000000000").toBuffer(),
        -4
      ).toString()
    ).to.equal("100000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("100000000000000").toBuffer(),
        -10
      ).toString()
    ).to.equal("1000000000000000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("123456789876543212345678").toBuffer(),
        -4
      ).toString()
    ).to.equal("1234567898765432123456780000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-10000000000").toBuffer(),
        -4
      ).toString()
    ).to.equal("-100000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-100000000000000").toBuffer(),
        -10
      ).toString()
    ).to.equal("-1000000000000000000000000");
    expect(
      DecimalExt.from128Buffer(
        new Number128("-123456789876543212345678").toBuffer(),
        -4
      ).toString()
    ).to.equal("-1234567898765432123456780000");
  });

  it("to128Buffer", function () {
    expect(DecimalExt.to128Buffer(new Decimal("0")).toString()).to.equal(
      new Number128("0").toBuffer().toString()
    );
    expect(DecimalExt.to128Buffer(new Decimal("1")).toString()).to.equal(
      new Number128("1").toBuffer().toString()
    );
    expect(DecimalExt.to128Buffer(new Decimal("10")).toString()).to.equal(
      new Number128("10").toBuffer().toString()
    );
    expect(DecimalExt.to128Buffer(new Decimal("1000")).toString()).to.equal(
      new Number128("1000").toBuffer().toString()
    );
    expect(DecimalExt.to128Buffer(new Decimal("1000000")).toString()).to.equal(
      new Number128("1000000").toBuffer().toString()
    );
    expect(
      DecimalExt.to128Buffer(new Decimal("1000000000000")).toString()
    ).to.equal(new Number128("1000000000000").toBuffer().toString());
    expect(
      DecimalExt.to128Buffer(
        new Decimal("1000000000000000000000000")
      ).toString()
    ).to.equal(
      new Number128("1000000000000000000000000").toBuffer().toString()
    );
    expect(
      DecimalExt.to128Buffer(
        new Decimal("100000000000000000000000000000000000")
      ).toString()
    ).to.equal(
      new Number128("100000000000000000000000000000000000")
        .toBuffer()
        .toString()
    );
    expect(DecimalExt.to128Buffer(new Decimal("-0")).toString()).to.equal(
      new Number128("-0").toBuffer().toString()
    );
    expect(DecimalExt.to128Buffer(new Decimal("-1")).toString()).to.equal(
      new Number128("-1").toBuffer().toString()
    );
    expect(DecimalExt.to128Buffer(new Decimal("-10")).toString()).to.equal(
      new Number128("-10").toBuffer().toString()
    );
    expect(DecimalExt.to128Buffer(new Decimal("-1000")).toString()).to.equal(
      new Number128("-1000").toBuffer().toString()
    );
    expect(DecimalExt.to128Buffer(new Decimal("-1000000")).toString()).to.equal(
      new Number128("-1000000").toBuffer().toString()
    );
    expect(
      DecimalExt.to128Buffer(new Decimal("-1000000000000")).toString()
    ).to.equal(new Number128("-1000000000000").toBuffer().toString());
    expect(
      DecimalExt.to128Buffer(
        new Decimal("-1000000000000000000000000")
      ).toString()
    ).to.equal(
      new Number128("-1000000000000000000000000").toBuffer().toString()
    );
    expect(
      DecimalExt.to128Buffer(
        new Decimal("-100000000000000000000000000000000000")
      ).toString()
    ).to.equal(
      new Number128("-100000000000000000000000000000000000")
        .toBuffer()
        .toString()
    );
    expect(
      DecimalExt.to128Buffer(
        new Decimal("123456789876543215678987654321")
      ).toString()
    ).to.equal(
      new Number128("123456789876543215678987654321").toBuffer().toString()
    );
    expect(
      DecimalExt.to128Buffer(
        new Decimal("-123456789876543215678987654321")
      ).toString()
    ).to.equal(
      new Number128("-123456789876543215678987654321").toBuffer().toString()
    );
    expect(DecimalExt.to128Buffer(new Decimal(MAX_128)).toString()).to.equal(
      new Number128(MAX_128).toBuffer().toString()
    );
    expect(DecimalExt.to128Buffer(new Decimal(MIN_128)).toString()).to.equal(
      new Number128(MIN_128).toBuffer().toString()
    );
    expect(
      DecimalExt.to128Buffer(new Decimal("1000000"), 4).toString()
    ).to.equal(new Number128("10000000000").toBuffer().toString());
    expect(
      DecimalExt.to128Buffer(new Decimal("1000000"), 10).toString()
    ).to.equal(new Number128("10000000000000000").toBuffer().toString());
    expect(
      DecimalExt.to128Buffer(new Decimal("1000000"), -4).toString()
    ).to.equal(new Number128("100").toBuffer().toString());
    expect(
      DecimalExt.to128Buffer(new Decimal("100000000000"), -10).toString()
    ).to.equal(new Number128("10").toBuffer().toString());
  });

  it("fromU128Buffer", function () {
    expect(
      DecimalExt.fromU128Buffer(new Number128("0").toBuffer()).toString()
    ).to.equal("0");
    expect(
      DecimalExt.fromU128Buffer(new Number128("1").toBuffer()).toString()
    ).to.equal("1");
    expect(
      DecimalExt.fromU128Buffer(new Number128("100").toBuffer()).toString()
    ).to.equal("100");
    expect(
      DecimalExt.fromU128Buffer(new Number128("1000").toBuffer()).toString()
    ).to.equal("1000");
    expect(
      DecimalExt.fromU128Buffer(new Number128("10000").toBuffer()).toString()
    ).to.equal("10000");
    expect(
      DecimalExt.fromU128Buffer(new Number128("1000000").toBuffer()).toString()
    ).to.equal("1000000");
    expect(
      DecimalExt.fromU128Buffer(
        new Number128("100000000").toBuffer()
      ).toString()
    ).to.equal("100000000");
    expect(
      DecimalExt.fromU128Buffer(
        new Number128("10000000000").toBuffer()
      ).toString()
    ).to.equal("10000000000");
    expect(
      DecimalExt.fromU128Buffer(
        new Number128("100000000000000").toBuffer()
      ).toString()
    ).to.equal("100000000000000");
    expect(
      DecimalExt.fromU128Buffer(
        new Number128("10000000000000000000000").toBuffer()
      ).toString()
    ).to.equal("10000000000000000000000");
    expect(
      DecimalExt.fromU128Buffer(
        new Number128("100000000000000000000000000").toBuffer()
      ).toString()
    ).to.equal("100000000000000000000000000");
    expect(
      DecimalExt.fromU128Buffer(
        new Number128("10000000000000000000000000000000000").toBuffer()
      ).toString()
    ).to.equal("10000000000000000000000000000000000");
    expect(
      DecimalExt.fromU128Buffer(
        new Number128("100000000000000").toBuffer()
      ).toString()
    ).to.equal("100000000000000");
    expect(
      DecimalExt.fromU128Buffer(
        new Number128("123456789876543212345678987654321").toBuffer()
      ).toString()
    ).to.equal("123456789876543212345678987654321");
    expect(
      DecimalExt.fromU128Buffer(
        new Number128("123456789876543212345678987654321").toBuffer(),
        10
      ).toString()
    ).to.equal("12345678987654321234567.8987654321");
    expect(
      DecimalExt.fromU128Buffer(new Number128(MAX_U128).toBuffer()).toString()
    ).to.equal(MAX_U128);
  });

  it("toU128Buffer", function () {
    expect(DecimalExt.toU128Buffer(new Decimal("0")).toString()).to.equal(
      new Numberu128("0").toBuffer().toString()
    );
    expect(DecimalExt.toU128Buffer(new Decimal("1")).toString()).to.equal(
      new Numberu128("1").toBuffer().toString()
    );
    expect(DecimalExt.toU128Buffer(new Decimal("10")).toString()).to.equal(
      new Numberu128("10").toBuffer().toString()
    );
    expect(DecimalExt.toU128Buffer(new Decimal("1000")).toString()).to.equal(
      new Numberu128("1000").toBuffer().toString()
    );
    expect(
      DecimalExt.toU128Buffer(
        new Decimal("123456789876543215678987654321")
      ).toString()
    ).to.equal(
      new Numberu128("123456789876543215678987654321").toBuffer().toString()
    );
    expect(
      DecimalExt.toU128Buffer(
        new Decimal("123456789876543215678987654321"),
        -10
      ).toString()
    ).to.equal(new Numberu128("12345678987654321567").toBuffer().toString());
    expect(DecimalExt.toU128Buffer(new Decimal(MAX_U128)).toString()).to.equal(
      new Numberu128(MAX_U128).toBuffer().toString()
    );
  });
});
