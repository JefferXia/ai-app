export interface WeChatConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export interface WeChatTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
}

export interface WeChatUserInfo {
  openid: string;
  nickname: string;
  sex: number;
  province: string;
  city: string;
  country: string;
  headimgurl: string;
  privilege: string[];
  unionid?: string;
}

export const wechatConfig: WeChatConfig = {
  appId: process.env.NEXT_PUBLIC_WECHAT_APP_ID || '',
  appSecret: process.env.WECHAT_APP_SECRET || '',
  redirectUri: process.env.NEXT_PUBLIC_WECHAT_REDIRECT_URI || '',
};

// 生成微信授权URL
export function generateWeChatAuthUrl(state: string = ''): string {
  const params = new URLSearchParams({
    appid: wechatConfig.appId,
    redirect_uri: encodeURIComponent(wechatConfig.redirectUri),
    response_type: 'code',
    scope: 'snsapi_login',
    state: state,
  });
  
  return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
}

// 通过code获取access_token
export async function getWeChatAccessToken(code: string): Promise<WeChatTokenResponse> {
  const params = new URLSearchParams({
    appid: wechatConfig.appId,
    secret: wechatConfig.appSecret,
    code: code,
    grant_type: 'authorization_code',
  });

  const response = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error('Failed to get WeChat access token');
  }

  const data = await response.json();
  
  if (data.errcode) {
    throw new Error(`WeChat API error: ${data.errmsg}`);
  }

  return data;
}

// 通过access_token获取用户信息
export async function getWeChatUserInfo(accessToken: string, openid: string): Promise<WeChatUserInfo> {
  const params = new URLSearchParams({
    access_token: accessToken,
    openid: openid,
  });

  const response = await fetch(`https://api.weixin.qq.com/sns/userinfo?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error('Failed to get WeChat user info');
  }

  const data = await response.json();
  
  if (data.errcode) {
    throw new Error(`WeChat API error: ${data.errmsg}`);
  }

  return data;
}

// 刷新access_token
export async function refreshWeChatToken(refreshToken: string): Promise<WeChatTokenResponse> {
  const params = new URLSearchParams({
    appid: wechatConfig.appId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(`https://api.weixin.qq.com/sns/oauth2/refresh_token?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error('Failed to refresh WeChat token');
  }

  const data = await response.json();
  
  if (data.errcode) {
    throw new Error(`WeChat API error: ${data.errmsg}`);
  }

  return data;
}
