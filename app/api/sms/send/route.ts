import { NextRequest, NextResponse } from 'next/server'
import { createHash, createHmac } from 'crypto'

// 超时时间设置为60秒
export const maxDuration = 60

// 验证手机号格式的函数
function isValidPhoneNumber(phone: string): boolean {
  // 中国大陆手机号正则表达式
  // 支持以下格式：
  // 1. 13x-19x 开头的11位数字
  // 2. 支持 +86 前缀
  const phoneRegex = /^(\+86)?1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

// 生成签名
function generateSignature(
  method: string,
  uri: string,
  query: string,
  headers: Record<string, string>,
  body: string,
  accessKeyId: string,
  secretKey: string
): string {
  // 1. 创建规范化请求字符串
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key.toLowerCase()}:${headers[key]}`)
    .join('\n')
  
  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';')
  
  const hashedPayload = createHash('sha256').update(body).digest('hex')
  
  const canonicalRequest = [
    method,
    uri,
    query,
    canonicalHeaders,
    '',
    signedHeaders,
    hashedPayload
  ].join('\n')
  
  // 2. 创建待签名字符串
  const algorithm = 'HMAC-SHA256'
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const date = timestamp.slice(0, 8)
  const credentialScope = `${date}/cn-north-1/volcSMS/request`
  
  const hashedCanonicalRequest = createHash('sha256').update(canonicalRequest).digest('hex')
  
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    hashedCanonicalRequest
  ].join('\n')
  
  // 3. 计算签名
  const kDate = createHmac('sha256', secretKey).update(date).digest()
  const kRegion = createHmac('sha256', kDate).update('cn-north-1').digest()
  const kService = createHmac('sha256', kRegion).update('volcSMS').digest()
  const kSigning = createHmac('sha256', kService).update('request').digest()
  
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')
  
  // 4. 创建授权头
  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  
  return authorization
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone } = body || {}

    if (!phone) {
      return NextResponse.json(
        { error: '请输入手机号' },
        { status: 400 }
      );
    }

    // 验证手机号格式（国内）
    if (!isValidPhoneNumber(phone)) {
      return NextResponse.json(
        { error: '手机号格式不正确，请输入有效的中国大陆手机号' },
        { status: 400 }
      );
    }

    const accessKeyId = process.env.VOLC_ACCESSKEY
    const secretKey = process.env.VOLC_SECRETKEY
    const smsAccount = process.env.VOLC_SMS_ACCOUNT
    const smsSign = process.env.VOLC_SMS_SIGN
    const smsTemplateId = process.env.VOLC_SMS_TEMPLATE_ID

    if (!accessKeyId || !secretKey) {
      return NextResponse.json(
        { error: '未配置火山引擎AK/SK，请设置 VOLC_ACCESSKEY 与 VOLC_SECRETKEY' },
        { status: 500 }
      )
    }
    if (!smsAccount || !smsSign || !smsTemplateId) {
      return NextResponse.json(
        { error: '未配置短信参数，请设置 VOLC_SMS_ACCOUNT、VOLC_SMS_SIGN、VOLC_SMS_TEMPLATE_ID' },
        { status: 500 }
      )
    }

    const payload = {
      SmsAccount: smsAccount,
      Sign: smsSign,
      TemplateID: smsTemplateId,
      PhoneNumber: phone,
      CodeType: 6,
      ExpireTime: 600,
      Scene: '注册验证码',
    }

    const requestBody = JSON.stringify(payload)
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
    
    // 准备请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
      'Host': 'sms.volcengineapi.com',
      'X-Date': timestamp,
      'X-Content-Sha256': createHash('sha256').update(requestBody).digest('hex')
    }

    // 生成授权签名
    const authorization = generateSignature(
      'POST',
      '/',
      'Action=SendSmsVerifyCode&Version=2020-01-01',
      headers,
      requestBody,
      accessKeyId,
      secretKey
    )

    headers.Authorization = authorization

    const url = 'https://sms.volcengineapi.com/?Action=SendSmsVerifyCode&Version=2020-01-01'

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: requestBody,
    })

    const data = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      return NextResponse.json(
        { error: '发送短信失败', detail: data },
        { status: resp.status }
      )
    }

    return NextResponse.json({ success: true, result: data?.Result, metadata: data?.ResponseMetadata })
  } catch (error: any) {
    console.error('SendSms error:', error)
    return NextResponse.json(
      { error: '请求处理失败', detail: String(error?.message || error) },
      { status: 500 }
    );
  }
}
