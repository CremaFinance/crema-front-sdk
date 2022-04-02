import type { Blob, Layout } from "@solana/buffer-layout";
import { blob } from "@solana/buffer-layout";
import type { AccountInfo } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import type Decimal from "decimal.js";

import { DecimalExt } from "./decimalExt";

export type Parser<T> = (
  pubkey: PublicKey,
  info: AccountInfo<Buffer>
) =>
  | {
      pubkey: PublicKey;
      info: AccountInfo<Buffer>;
      data: T;
    }
  | undefined;

/** @internal */
export interface EncodeDecode<T> {
  decode: (buffer: Buffer, offset?: number) => T;
  encode: (src: T, buffer: Buffer, offset?: number) => number;
}

/** @internal */
export const encodeDecode = <T>(layout: Layout<T>): EncodeDecode<T> => {
  const decode = layout.decode.bind(layout);
  const encode = layout.encode.bind(layout);
  return { decode, encode };
};

export const publicKey = (property = "publicKey"): Layout<PublicKey> => {
  const layout = blob(32, property);
  const { encode, decode } = encodeDecode(layout);

  const publicKeyLayout = layout as Layout<unknown> as Layout<PublicKey>;

  publicKeyLayout.decode = (buffer: Buffer, offset: number) => {
    const src = decode(buffer, offset);
    return new PublicKey(src);
  };

  publicKeyLayout.encode = (
    publicKey: PublicKey,
    buffer: Buffer,
    offset: number
  ) => {
    const src = publicKey.toBuffer();
    return encode(src, buffer, offset);
  };

  return publicKeyLayout;
};

export const uint64 = (property = "uint128"): Blob => {
  return blob(8, property);
};

export const int64 = (property = "uint128"): Blob => {
  return blob(8, property);
};

export const int128 = (property = "uint128"): Blob => {
  return blob(16, property);
};

export const uint128 = (property = "uint128"): Blob => {
  return blob(16, property);
};

export const decimal64 = (
  property = "uint64",
  precision = 0
): Layout<Decimal> => {
  const layout = blob(8, property);
  //const { encode, decode } = encodeDecode(layout);
  const decimal64Layout = layout as Layout<unknown> as Layout<Decimal>;

  const _decode = layout.decode.bind(layout);
  const _encode = layout.encode.bind(layout);

  decimal64Layout.decode = (buffer: Buffer, offset: number) => {
    const src = Buffer.from(_decode(buffer, offset));
    return DecimalExt.from64Buffer(src, precision);
  };

  decimal64Layout.encode = (
    decimal: Decimal,
    buffer: Buffer,
    offset: number
  ) => {
    const src = DecimalExt.to64Buffer(decimal, precision);
    return _encode(src, buffer, offset);
  };

  return decimal64Layout;
};

export const decimalU64 = (
  property = "uint64",
  precision = 0
): Layout<Decimal> => {
  const layout = blob(8, property);
  //const { encode, decode } = encodeDecode(layout)
  const _decode = layout.decode.bind(layout);
  const _encode = layout.encode.bind(layout);
  const decimalU64Layout = layout as Layout<unknown> as Layout<Decimal>;

  decimalU64Layout.decode = (buffer: Buffer, offset: number) => {
    const src = Buffer.from(_decode(buffer, offset));
    return DecimalExt.fromU64Buffer(src, precision);
  };

  decimalU64Layout.encode = (
    decimal: Decimal,
    buffer: Buffer,
    offset: number
  ) => {
    const src = DecimalExt.toU64Buffer(decimal, precision);
    return _encode(src, buffer, offset);
  };

  return decimalU64Layout;
};

export const decimal128 = (
  property = "uint64",
  precision = 0
): Layout<Decimal> => {
  const layout = blob(16, property);
  //const { encode, decode } = encodeDecode(layout);
  const _decode = layout.decode.bind(layout);
  const _encode = layout.encode.bind(layout);
  const decimal128Layout = layout as Layout<unknown> as Layout<Decimal>;

  decimal128Layout.decode = (buffer: Buffer, offset: number) => {
    const src = Buffer.from(_decode(buffer, offset));
    return DecimalExt.from128Buffer(src, precision);
  };

  decimal128Layout.encode = (
    decimal: Decimal,
    buffer: Buffer,
    offset: number
  ) => {
    const src = DecimalExt.to128Buffer(decimal, precision);
    return _encode(src, buffer, offset);
  };

  return decimal128Layout;
};

export const decimalU128 = (
  property = "uint64",
  precision = 0
): Layout<Decimal> => {
  const layout = blob(16, property);
  //const { encode, decode } = encodeDecode(layout);
  const _decode = layout.decode.bind(layout);
  const _encode = layout.encode.bind(layout);
  const decimalU128Layout = layout as Layout<unknown> as Layout<Decimal>;

  decimalU128Layout.decode = (buffer: Buffer, offset: number) => {
    const src = Buffer.from(_decode(buffer, offset));
    const val = DecimalExt.fromU128Buffer(src, precision);
    return val;
  };

  decimalU128Layout.encode = (
    decimal: Decimal,
    buffer: Buffer,
    offset: number
  ) => {
    const src = DecimalExt.toU128Buffer(decimal, precision);
    return _encode(src, buffer, offset);
  };

  return decimalU128Layout;
};
