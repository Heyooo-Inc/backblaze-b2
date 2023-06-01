import { readFileSync } from 'fs'
import { BackblazeB2 } from '../src'
import { isNotNil, timestamp } from '@heyooo-inc/utils'

describe('BackblazeB2', () => {
  let b2: BackblazeB2

  beforeAll(() => {
    b2 = new BackblazeB2({
      accountId: process.env.BACKBLAZE_KEY_ID as string,
      masterApplicationKey: process.env.BACKBLAZE_APPLICATION_KEY as string
    })
  })

  test('should upload file', async () => {
    const { authorizationToken, uploadUrl } = await b2.getUploadUrl(process.env.BACKBLAZE_BUCKET_ID as string)
    const fileName = timestamp() + '-package.json'
    const result = await b2.uploadFile({
      file: readFileSync('./package.json'),
      fileName,
      contentType: 'text/json',
      authorizationToken,
      uploadUrl
    })

    expect(isNotNil(result?.fileId)).toBe(true)
    expect(result?.fileName).toBe(fileName)
  })
})
