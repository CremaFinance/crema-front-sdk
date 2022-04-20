import type { PublicKey } from "@solana/web3.js";
import axios from "axios";

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
}

export interface Response {
  reqId: string;
  code: string;
  msg: string;
  data: Array<TokenInfo>;
}

const endpoint = "https://api.crema.finance/config?name=token-list";

const defaultTokenList = [
  {
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    decimals: 6,
  },
  {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    decimals: 6,
  },
  {
    address: "9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i",
    symbol: "UST",
    decimals: 6,
  },
  {
    address: "Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS",
    symbol: "PAI",
    decimals: 6,
  },
  {
    address: "USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX",
    symbol: "USDH",
    decimals: 6,
  },
  {
    address: "3RudPTAkfcq9Q9Jk8SVeCoecCBmdKMj6q5smsWzxqtqZ",
    symbol: "pUSDT",
    decimals: 6,
  },
  {
    address: "FgSsGV8GByPaMERxeQJPvZRZHf7zCBhrdYtztKorJS58",
    symbol: "pUSDC",
    decimals: 6,
  },
  {
    address: "Gcu9zjxrjez4xWGj8bi2gTLXYN8hD8Avu2tN8xfnV65Q",
    symbol: "CUSD",
    decimals: 8,
  },
  {
    address: "GHStiPQDe4HEQxtDzyFFuNjP6Z6GqYhbPqJ6oiRFmGWT",
    symbol: "CUSDC",
    decimals: 8,
  },
  {
    address: "1msZrgEMrhEzhLWjGvEpqo3RUuzMWGs4x9S6j3Nk1hK",
    symbol: "CSOL",
    decimals: 8,
  },
  {
    address: "32JXVurQacMxQF6qFxKkeAbysQcXsCakuYx3eyYRBoSR",
    symbol: "tCAF",
    decimals: 6,
  },
  {
    address: "CAFTP2Yof8bJuwSScigqnZaLQKiBzECgJPxvEDzfivzw",
    symbol: "CAF",
    decimals: 6,
  },
  {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    decimals: 9,
  },
];

const tokens: Map<string, TokenInfo> = new Map();

export async function loadTokens() {
  defaultTokenList.forEach((v) => {
    tokens.set(v.address, {
      name: v.symbol,
      ...v,
    });
  });

  const response = await axios.get(endpoint);
  if (response.status !== 200) {
    console.log("fetch tokens failed status:", response.status);
    return;
  }
  const resp: Response = response.data;
  if (resp.code !== "OK") {
    console.log("fetch tokens failed code:%s msg:%s", resp.code, resp.msg);
    return;
  }
  resp.data.forEach((v) => {
    tokens.set(v.address, {
      ...v,
    });
  });
}

export function getTokenInfo(address: PublicKey): TokenInfo | undefined {
  return tokens.get(address.toBase58());
}
