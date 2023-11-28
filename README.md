This is a [Next.js](https://nextjs.org/) project integrating [Anon Aadhaar](https://github.com/privacy-scaling-explorations/anon-aadhaar)

## Getting Started

First, install the dependencies:

```bash
yarn install
```

Add your appId under `NEXT_PUBLIC_APP_ID` to your `.env.local`

Then, run the development server:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can use our test file `./public/signed.pdf` with the password `test123` to generate a proof.
