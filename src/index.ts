import { deepMerge, timestamp } from '@heyooo-inc/utils'
import ky from 'ky'
import { BinaryLike, createHash } from 'crypto'

export interface BackblazeB2Options {
  accountId: string
  masterApplicationKey: string
  refreshTokenInterval: number
  version: string
  fetch?: {
    timeout?: number
    retry?: number
  }
}

export interface BackblazeB2File {
  accountId: string
  action: string
  bucketId: string
  contentLength: number
  contentMd5: string
  contentSha1: string
  contentType: string
  fileId: string
  fileInfo: Record<string, unknown>
  fileName: string
  fileRetention: {
    isClientAuthorizedToRead: boolean
    value: unknown
  }
  legalHold: {
    isClientAuthorizedToRead: boolean
    value: unknown
  }
  serverSideEncryption: {
    algorithm: unknown
    mode: unknown
  }
  uploadTimestamp: number
}

type Optional<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>> & { [P in K]?: T[P] }

const authorizeUrl = 'https://api.backblazeb2.com/b2api/v2/b2_authorize_account'
const defaultOptions: Partial<BackblazeB2Options> = {
  version: 'v2',
  refreshTokenInterval: 60 * 60, // 1 hour
  fetch: {
    timeout: 5_000,
    retry: 2
  }
}

function sha1(content: BinaryLike) {
  return createHash('sha1').update(content).digest('hex')
}

function base64(text: string) {
  return Buffer.from(text).toString('base64')
}

export class BackblazeB2 {
  private readonly options: BackblazeB2Options
  private authorizationToken?: string
  private downloadUrl?: string
  private apiUrl?: string
  private authorizedAt = 0

  constructor(options: Optional<BackblazeB2Options, 'refreshTokenInterval' | 'version' | 'fetch'>) {
    this.options = deepMerge(defaultOptions, options) as BackblazeB2Options
  }

  public async getUploadUrl(bucketId: string) {
    await this.authorize()

    return ky
      .post(`${this.apiUrl}/b2_get_upload_url`, {
        body: JSON.stringify({
          bucketId
        }),
        headers: {
          Authorization: this.authorizationToken
        },
        ...this.options.fetch
      })
      .json<{
        authorizationToken: string
        uploadUrl: string
      }>()
  }

  public async uploadFile(params: {
    file: Buffer
    uploadUrl: string
    authorizationToken: string
    fileName: string
    contentType?: string
  }) {
    await this.authorize()

    const hash = sha1(params.file)

    return ky
      .post(params.uploadUrl, {
        body: params.file,
        headers: {
          Authorization: params.authorizationToken,
          'X-Bz-File-Name': encodeURI(params.fileName),
          'X-Bz-Content-Sha1': hash,
          'Content-Type': params.contentType || 'b2/x-auto',
          'Content-Length': String(params.file.length)
        },
        ...this.options.fetch
      })
      .json<BackblazeB2File>()
  }

  public async deleteFileVersion(fileName: string, fileId: string) {
    await this.authorize()

    return ky
      .post(`${this.apiUrl}/b2_delete_file_version`, {
        body: JSON.stringify({
          fileName,
          fileId
        }),
        headers: {
          Authorization: this.authorizationToken
        },
        ...this.options.fetch
      })
      .json()
  }

  public async downloadFileById(fileId: string) {
    await this.authorize()

    return ky
      .get(`${this.downloadUrl}/b2api/v2/b2_download_file_by_id?fileId=${fileId}`, {
        headers: {
          Authorization: this.authorizationToken
        },
        ...this.options.fetch
      })
      .json()
  }

  private async authorize() {
    const now = timestamp()

    if (this.authorizationToken && this.authorizedAt + this.options.refreshTokenInterval > now) {
      return
    }

    const { authorizationToken, downloadUrl, apiUrl } = await ky
      .get(authorizeUrl, {
        headers: {
          Authorization: `Basic ${base64(
            `${this.options.accountId}:${this.options.masterApplicationKey}`
          )}`
        },
        ...this.options.fetch
      })
      .json<{
        authorizationToken: string
        downloadUrl: string
        apiUrl: string
      }>()

    this.authorizationToken = authorizationToken
    this.downloadUrl = downloadUrl
    this.apiUrl = `${apiUrl}/b2api/${this.options.version}`
    this.authorizedAt = now
  }
}
