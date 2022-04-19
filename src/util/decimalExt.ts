import BN from "bn.js";
import Decimal from "decimal.js";
import invariant from "tiny-invariant";

Decimal.config({
  precision: 64,
  rounding: Decimal.ROUND_DOWN,
  toExpNeg: -64,
  toExpPos: 64,
});

const TEN = new Decimal(10);
const P64 = new Decimal(2).pow(64);
const MAX_INT64 = P64.div(2).sub(1);
const MIN_INT64 = P64.div(2).neg();
const MAX_UINT64 = P64.sub(1);
const MAX_INT128 = P64.pow(63).sub(1);
const MIN_INT128 = MAX_INT128.neg();
const MAX_UINT128 = P64.pow(64).sub(1);
const MAX_PRECISION = 40;

export class DecimalExt {
  /**
   * New a Decimal from a int64 buffer
   * @param buffer The buffer
   * @param precision The pricision
   * @returns The Decimal value, the result will be div 10^precision
   */
  static from64Buffer(buffer: Buffer, precision = 0): Decimal {
    invariant(buffer.length === 8, `Invalid buffer length: ${buffer.length}`);
    invariant(
      Math.abs(precision) < MAX_PRECISION,
      `Invalid precision: ${precision}`
    );
    invariant(buffer[7] !== undefined);
    if (buffer[7] >= 0x80) {
      const ss = [];
      for (const v of buffer) {
        ss.push(`00${Math.abs(~v & 0xff).toString(16)}`.slice(-2));
      }
      const bn = new BN(ss.join(""), 16, "le").add(new BN(1)).neg();
      return new Decimal(bn.toString()).div(TEN.pow(precision));
    }
    return new Decimal(new BN(buffer, "le").toString()).div(TEN.pow(precision));
  }

  /**
   * New a Decimal from a uint64 buffer
   * @param buffer The buffer
   * @param precision The precision
   * @returns The Decimal value, the result will be div 10^precision
   */
  static fromU64Buffer(buffer: Buffer, precision = 0): Decimal {
    invariant(buffer.length === 8, `Invalid buffer length: ${buffer.length}`);
    invariant(
      Math.abs(precision) < MAX_PRECISION,
      `Invalid precision: ${precision}`
    );
    return new Decimal(new BN(buffer, 16, "le").toString()).div(
      TEN.pow(precision)
    );
  }

  /**
   * New a Decimal from a int128 buffer
   * @param buffer The buffer
   * @param precision The pricision
   * @returns The Decimal value, the result will be div 10^precision
   */
  static from128Buffer(buffer: Buffer, precision = 0): Decimal {
    invariant(buffer.length === 16, `Invalid buffer length: ${buffer.length}`);
    invariant(
      Math.abs(precision) < MAX_PRECISION,
      `Invalid precision: ${precision}`
    );

    invariant(buffer[15] !== undefined);
    if (buffer[15] >= 0x80) {
      const ss = [];
      for (const v of buffer) {
        ss.push(`00${Math.abs(~v & 0xff).toString(16)}`.slice(-2));
      }
      const bn = new BN(ss.join(""), 16, "le").add(new BN(1)).neg();
      return new Decimal(bn.toString()).div(TEN.pow(precision));
    }
    return new Decimal(new BN(buffer, "le").toString()).div(TEN.pow(precision));
  }

  /**
   * New a Decimal from a uint128 buffer
   * @param buffer The buffer
   * @param precision The precision
   * @returns The Decimal value, the result will be div 10^precision
   */
  static fromU128Buffer(buffer: Buffer, precision = 0): Decimal {
    invariant(buffer.length === 16, `Invalid buffer length: ${buffer.length}`);
    invariant(
      Math.abs(precision) < MAX_PRECISION,
      `Invalid precision: ${precision}`
    );
    return new Decimal(new BN(buffer, "le").toString()).div(TEN.pow(precision));
  }

  /**
   * Convert a Decimal value to int64 buffer
   * @param v The Decimal value
   * @param precision The precision
   * @returns The buffer, the result will be mul 10^precision
   */
  static to64Buffer(v: Decimal, precision = 0): Buffer {
    invariant(
      Math.abs(precision) < MAX_PRECISION,
      `Invalid precision: ${precision}`
    );
    v = v.mul(TEN.pow(precision)).round();
    invariant(
      v.greaterThanOrEqualTo(MIN_INT64) && v.lessThanOrEqualTo(MAX_INT64),
      `Invalid v: ${v.toString()} to int128 buffer with precision: ${precision}`
    );
    const bn = new BN(v.toString());
    if (bn.isNeg()) {
      const buffer = bn.add(new BN(1)).toArrayLike(Buffer, "le", 8);
      buffer.forEach(function (item, index, input) {
        input[index] = ~item & 0xff;
      });
      return buffer;
    } else {
      return bn.toArrayLike(Buffer, "le", 8);
    }
  }

  /**
   * Convert a Decimal value to uint64 buffer
   * @param v The Decimal value
   * @param precision The precision
   * @returns The buffer, the result will be mul 10^precision
   */
  static toU64Buffer(v: Decimal, precision = 0): Buffer {
    invariant(
      Math.abs(precision) < MAX_PRECISION,
      `Invalid precision: ${precision}`
    );
    v = v.mul(TEN.pow(precision)).round();
    invariant(
      v.greaterThanOrEqualTo(0) && v.lessThanOrEqualTo(MAX_UINT64),
      `Invalid v: ${v.toString()} to uint64 buffer with precision: ${precision}`
    );
    return new BN(v.toString()).toArrayLike(Buffer, "le", 8);
  }

  /**
   * Convert a Decimal value to int128 buffer
   * @param v The Decimal value
   * @param precision The precision
   * @returns The buffer, the result will be mul 10^precision
   */
  static to128Buffer(v: Decimal, precision = 0): Buffer {
    invariant(
      Math.abs(precision) < MAX_PRECISION,
      `Invalid precision: ${precision}`
    );
    v = v.mul(TEN.pow(precision)).round();
    invariant(
      v.greaterThanOrEqualTo(MIN_INT128) && v.lessThanOrEqualTo(MAX_INT128),
      `Invalid v: ${v.toString()} to int128 buffer with precision: ${precision}`
    );
    const bn = new BN(v.toString());
    if (bn.isNeg()) {
      const buffer = bn.add(new BN(1)).toArrayLike(Buffer, "le", 16);
      buffer.forEach(function (item, index, input) {
        input[index] = ~item & 0xff;
      });
      return buffer;
    } else {
      return bn.toArrayLike(Buffer, "le", 16);
    }
  }

  /**
   * Convert a Decimal value to uint128 buffer
   * @param v The Decimal value
   * @param precision The precision
   * @returns The buffer, the result will be mul 10^precision
   */
  static toU128Buffer(v: Decimal, precision = 0): Buffer {
    invariant(
      Math.abs(precision) < MAX_PRECISION,
      `Invalid precision: ${precision}`
    );
    v = v.mul(TEN.pow(precision)).round();
    invariant(
      v.greaterThanOrEqualTo(0) && v.lessThanOrEqualTo(MAX_UINT128),
      `Invalid v: ${v.toString()} to int128 buffer with precision: ${precision}`
    );
    return new BN(v.toString()).toArrayLike(Buffer, "le", 16);
  }
}
