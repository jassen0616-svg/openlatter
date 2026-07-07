import DmClient, { SingleSendMailRequest } from "@alicloud/dm20151123";
import { Config } from "@alicloud/openapi-client";

import { createWelcomeEmailTemplate } from "./welcomeEmailTemplate";

type SendWelcomeEmailResult = {
  envId?: string;
  requestId?: string;
};

let cachedClient: DmClient | null = null;

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readAccessKeyId() {
  return process.env.ALIYUN_ACCESS_KEY_ID || process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || "";
}

function readAccessKeySecret() {
  return process.env.ALIYUN_ACCESS_KEY_SECRET || process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || "";
}

function getDirectMailClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const accessKeyId = readAccessKeyId();
  const accessKeySecret = readAccessKeySecret();

  if (!accessKeyId) {
    throw new Error("Missing required environment variable: ALIYUN_ACCESS_KEY_ID");
  }

  if (!accessKeySecret) {
    throw new Error("Missing required environment variable: ALIYUN_ACCESS_KEY_SECRET");
  }

  const config = new Config({
    accessKeyId,
    accessKeySecret,
    endpoint: process.env.ALIYUN_DM_ENDPOINT || "dm.aliyuncs.com",
    regionId: process.env.ALIYUN_DM_REGION || "cn-hangzhou"
  });

  cachedClient = new DmClient(config);
  return cachedClient;
}

export async function sendWelcomeEmail(email: string): Promise<SendWelcomeEmailResult> {
  const template = createWelcomeEmailTemplate(email);
  const fromAlias = process.env.ALIYUN_DM_FROM_ALIAS || "openlatter";
  const accountName = requireEnv("ALIYUN_DM_ACCOUNT_NAME");

  const request = new SingleSendMailRequest({
    accountName,
    addressType: 1,
    clickTrace: "0",
    fromAlias,
    htmlBody: template.html,
    replyToAddress: true,
    subject: template.subject,
    textBody: template.text,
    toAddress: email,
    unSubscribeFilterLevel: "disabled",
    unSubscribeLinkType: "disabled"
  });

  const response = await getDirectMailClient().singleSendMail(request);

  return {
    envId: response.body?.envId,
    requestId: response.body?.requestId
  };
}
