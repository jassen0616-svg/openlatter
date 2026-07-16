import DmClient, { SingleSendMailRequest } from "@alicloud/dm20151123";
import { Config } from "@alicloud/openapi-client";
import { RuntimeOptions } from "@alicloud/tea-util";

import { createUnsubscribeUrl } from "./unsubscribe";
import { createWelcomeEmailTemplate } from "./welcomeEmailTemplate";

export type SendEmailResult = {
  envId?: string;
  requestId?: string;
};

export type SendEmailInput = {
  htmlBody?: string;
  subject: string;
  textBody?: string;
  toAddress: string;
};

let cachedClient: DmClient | null = null;

const DIRECT_MAIL_CONNECT_TIMEOUT_MS = 5_000;
const DIRECT_MAIL_READ_TIMEOUT_MS = 10_000;

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

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const fromAlias = process.env.ALIYUN_DM_FROM_ALIAS || "openlatter";
  const accountName = requireEnv("ALIYUN_DM_ACCOUNT_NAME");

  if (!input.htmlBody && !input.textBody) {
    throw new Error("Either htmlBody or textBody is required");
  }

  const request = new SingleSendMailRequest({
    accountName,
    addressType: 1,
    clickTrace: "0",
    fromAlias,
    htmlBody: input.htmlBody,
    replyToAddress: true,
    subject: input.subject,
    textBody: input.textBody,
    toAddress: input.toAddress,
    unSubscribeFilterLevel: "disabled",
    unSubscribeLinkType: "disabled"
  });

  const response = await getDirectMailClient().singleSendMailWithOptions(
    request,
    new RuntimeOptions({
      autoretry: false,
      connectTimeout: DIRECT_MAIL_CONNECT_TIMEOUT_MS,
      maxAttempts: 1,
      readTimeout: DIRECT_MAIL_READ_TIMEOUT_MS
    })
  );

  return {
    envId: response.body?.envId,
    requestId: response.body?.requestId
  };
}

export async function sendWelcomeEmail(email: string): Promise<SendEmailResult> {
  const template = createWelcomeEmailTemplate(email, createUnsubscribeUrl(email));

  return sendEmail({
    htmlBody: template.html,
    subject: template.subject,
    textBody: template.text,
    toAddress: email
  });
}
