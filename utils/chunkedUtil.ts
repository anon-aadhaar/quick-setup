import { splitToWords } from "anon-aadhaar-pcd";
import localforage from "localforage";
import { pki } from "node-forge";
import {
  bufferToHex,
  Uint8ArrayToCharArray,
} from "@zk-email/helpers/dist/binaryFormat";
import { sha256Pad } from "@zk-email/helpers/dist/shaHash";
import {
  ArgumentTypeName,
  StringArrayArgument,
  NumberArgument,
} from "@pcd/pcd-types";
import pako from "pako";

/**
 * @dev witness use for create zk proof of AnonAadhaarPCD package.
 */
export type AnonAadhaarPCDArgs = {
  padded_message: StringArrayArgument; // private witness
  message_len: NumberArgument; // private witness
  signature: StringArrayArgument; // public witness
  modulus: StringArrayArgument; // public witness
};

const snarkjs = require("snarkjs");

const zkeySuffix = ["", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
const loadUrl = "https://qzensy4rsgyppg6e.public.blob.vercel-storage.com/";
const WASM_URL = "https://d1re67zv2jtrxt.cloudfront.net/qr_verify.wasm";

export function convertBigIntToByteArray(bigInt: bigint) {
  const byteLength = Math.max(1, Math.ceil(bigInt.toString(2).length / 8));

  const result = new Uint8Array(byteLength);
  let i = 0;
  while (bigInt > 0) {
    result[i] = Number(bigInt % BigInt(256));
    bigInt = bigInt / BigInt(256);
    i += 1;
  }
  return result.reverse();
}

export function decompressByteArray(byteArray: Uint8Array) {
  const decompressedArray = pako.inflate(byteArray);
  return decompressedArray;
}

export async function downloadFromFilename(_filename: string) {
  const zkeyResp = await fetch(`${loadUrl}${_filename}`);

  if (!zkeyResp.ok) throw Error("Error while fetching the zkeyfiles");

  const zkeyBuff = await zkeyResp.arrayBuffer();

  await storeArrayBuffer(_filename, zkeyBuff);

  console.log(`Storage of ${_filename} successful!`);
}

// We can use this function to ensure the type stored in localforage is correct.
async function storeArrayBuffer(keyname: string, buffer: ArrayBuffer) {
  return await localforage.setItem(keyname, buffer);
}

export const downloadProofFiles = async function (
  _filename: string,
  onFileDownloaded: () => void
) {
  const filePromises = [];
  for (const c of zkeySuffix) {
    const filename = `${_filename}.zkey${c}`;
    const item = await localforage.getItem(
      `${filename}.zkey${c} already found in localforage!`
    );
    if (item) {
      console.log(`${_filename}.zkey${c}`);
      onFileDownloaded();
      continue;
    }
    filePromises.push(
      // downloadFromFilename(targzFilename, true).then(
      downloadFromFilename(`${_filename}.zkey${c}`).then(() =>
        onFileDownloaded()
      )
    );
  }
  console.log(filePromises);
  await Promise.all(filePromises);
};

export async function generateProof(input: any, filename: string) {
  // TODO: figure out how to generate this s.t. it passes build
  console.log("generating proof for input");
  console.log(input);

  //   const wasmBuf: ArrayBuffer = await fetchArti(WASM_URL);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    WASM_URL,
    `${filename}.zkey`
  );
  console.log(`Generated proof ${JSON.stringify(proof)}`);

  return {
    proof,
    publicSignals,
  };
}

export const fetchCertificateFile = async (
  certUrl: string
): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://nodejs-serverless-function-express-eight-iota.vercel.app/api/get-raw-pk?url=${certUrl}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch public key from server`);
    }

    const { certData } = await response.json();
    return certData;
  } catch (error) {
    console.error("Error fetching public key:", error);
    return null;
  }
};

export const genProof = async (
  args: any
): Promise<{ proof: any; publicSignals: any }> => {
  const input: {
    padded_message: string[];
    message_len: string[];
    signature: string[];
    modulus: string[];
  } = {
    padded_message: args.padded_message.value,
    message_len: args.message_len.value,
    signature: args.signature.value,
    modulus: args.modulus.value,
  };

  const { proof, publicSignals } = await generateProof(input, "circuit_final");

  console.log("Proof: ", proof);
  console.log("Public signals: ", publicSignals);
  return { proof, publicSignals };
};

/**
 * Extract all the information needed to generate the witness from the QRCode data.
 * @param qrData QrCode Data
 * @returns {witness}
 */
export const generateArgs = async (
  qrData: string,
  certificateFile: string
): Promise<AnonAadhaarPCDArgs> => {
  const bigIntData = BigInt(qrData);

  const byteArray = convertBigIntToByteArray(bigIntData);

  const decompressedByteArray = decompressByteArray(byteArray);

  // Read signature data
  const signature = decompressedByteArray.slice(
    decompressedByteArray.length - 256,
    decompressedByteArray.length
  );

  const signedData = decompressedByteArray.slice(
    0,
    decompressedByteArray.length - 256
  );

  const RSAPublicKey = pki.certificateFromPem(certificateFile).publicKey;
  const publicKey = (RSAPublicKey as pki.rsa.PublicKey).n.toString(16);

  const modulusBigint = BigInt("0x" + publicKey);

  const signatureBigint = BigInt(
    "0x" + bufferToHex(Buffer.from(signature)).toString()
  );

  const [paddedMessage, messageLength] = sha256Pad(signedData, 512 * 3);

  const pcdArgs: AnonAadhaarPCDArgs = {
    padded_message: {
      argumentType: ArgumentTypeName.StringArray,
      value: Uint8ArrayToCharArray(paddedMessage),
    },
    message_len: {
      argumentType: ArgumentTypeName.Number,
      value: messageLength.toString(),
    },
    signature: {
      argumentType: ArgumentTypeName.StringArray,
      value: splitToWords(signatureBigint, BigInt(64), BigInt(32)),
    },
    modulus: {
      argumentType: ArgumentTypeName.StringArray,
      value: splitToWords(modulusBigint, BigInt(64), BigInt(32)),
    },
  };

  return pcdArgs;
};
