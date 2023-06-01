# @heyooo-inc/backblaze-b2

Backblaze B2 SDK, a typescript version of [backblaze-b2-sdk](https://github.com/zenfulfillment/backblaze-b2-sdk)

## Installation

Install the library with `npm install @heyooo-inc/backblaze-b2` or `pnpm install @heyooo-inc/backblaze-b2`

## Usage

```js
import { BackblazeB2 } from '@heyooo-inc/backblaze-b2'

const b2 = new BackblazeB2({
  accountId: ACCOUNT_ID,
  masterApplicationKey: MASTER_APPLICATION_KEY
})

const { authorizationToken, uploadUrl } = await b2.getUploadUrl({
  bucketId: BUCKET_ID
})

await b2.uploadFile({
  authorizationToken,
  uploadUrl,
  fileName: 'test.txt',
  fileContent: Buffer.from('test content')
})
```

## Tests

Tests are using jest, to run the tests use:

```bash
$ npm run test
```

## MIT license
