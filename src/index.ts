import { deepMerge, timestamp } from '@heyooo-inc/utils'
import { type BinaryLike, createHash } from 'crypto'
import { OverridedAxiosInstance, createAxiosClient } from './axios'

export * from './axios'

export interface BackblazeB2Options {
  accountId: string
  masterApplicationKey: string
  refreshTokenInterval: number
  version: string
  requestOptions: {
    timeout?: number
    retries?: number
  }
}

export interface BackblazeB2UploadUrlResult {
  authorizationToken: string
  uploadUrl: string
}

export interface BackblazeB2Authorization {
  authorizationToken: string
  downloadUrl: string
  apiUrl: string
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
  requestOptions: {
    timeout: 5_000,
    retries: 2
  }
}

function sha1(content: BinaryLike) {
  return createHash('sha1').update(content).digest('hex')
}

export class BackblazeB2 {
  private readonly axiosClient: OverridedAxiosInstance
  private readonly options: BackblazeB2Options
  private authorizationToken?: string
  private downloadUrl?: string
  private apiUrl?: string
  private authorizedAt = 0

  constructor(options: Optional<BackblazeB2Options, 'refreshTokenInterval' | 'version' | 'requestOptions'>) {
    this.options = deepMerge(defaultOptions, options) as BackblazeB2Options
    this.axiosClient = createAxiosClient(this.options.requestOptions?.timeout, this.options.requestOptions?.retries)
  }

  public async getUploadUrl(bucketId: string) {
    await this.authorize()

    return this.axiosClient.post<BackblazeB2UploadUrlResult>(
      `${this.apiUrl}/b2_get_upload_url`,
      {
        bucketId
      },
      {
        headers: {
          Authorization: this.authorizationToken
        }
      }
    )
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

    return this.axiosClient.post<BackblazeB2File>(params.uploadUrl, params.file, {
      headers: {
        Authorization: params.authorizationToken,
        'X-Bz-File-Name': encodeURI(params.fileName),
        'X-Bz-Content-Sha1': hash,
        'Content-Type': params.contentType || 'b2/x-auto',
        'Content-Length': String(params.file.length)
      }
    })
  }

  public async deleteFileVersion(fileName: string, fileId: string) {
    await this.authorize()

    return this.axiosClient.post(
      `${this.apiUrl}/b2_delete_file_version`,
      {
        fileName,
        fileId
      },
      {
        headers: {
          Authorization: this.authorizationToken
        }
      }
    )
  }

  public async downloadFileById(fileId: string) {
    await this.authorize()

    return this.axiosClient.get(`${this.downloadUrl}/b2api/v2/b2_download_file_by_id?fileId=${fileId}`, {
      headers: {
        Authorization: this.authorizationToken
      }
    })
  }

  private async authorize() {
    const now = timestamp()

    if (this.authorizationToken && this.authorizedAt + this.options.refreshTokenInterval > now) {
      return
    }

    const { authorizationToken, downloadUrl, apiUrl } = await this.axiosClient.get<BackblazeB2Authorization>(
      authorizeUrl,
      {
        auth: {
          username: this.options.accountId,
          password: this.options.masterApplicationKey
        }
      }
    )

    this.authorizationToken = authorizationToken
    this.downloadUrl = downloadUrl
    this.apiUrl = `${apiUrl}/b2api/${this.options.version}`
    this.authorizedAt = now
  }
}
