import * as cdk from '@aws-cdk/core';
import { Table, AttributeType } from "@aws-cdk/aws-dynamodb";
import { Function, AssetCode, Runtime } from '@aws-cdk/aws-lambda';
import { RestApi, LambdaIntegration, IResource, MockIntegration, PassthroughBehavior } from "@aws-cdk/aws-apigateway";
import { RetentionDays } from '@aws-cdk/aws-logs';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as cloudfront from '@aws-cdk/aws-cloudfront';

//**************************************************** */
// 変数部分は自由に編集してください。
const stage = "dev"; // "stg","prd"
const bucketName = 'your-web-dev-bucket'
const projectName = 'yourProject-' + stage; // ステージごとにリポジトリを作り分け可能
const repositoryName = 'your-cdk-repository' + stage;
const branch = 'master'; // 'release','master'; 
const pipelineName = 'yourPipeline-' + stage;
const tableName = "YOUR_TABLE";
const yourFunctionName = 'your-function';
const restApiName = 'your-first-api';
//**************************************************** */

export class CdkTempleteStartupEditionStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //**************************************************** */
    // S3バケットの作成
    //**************************************************** */

    const s3Bucket = new s3.Bucket(this, 's3-bucket-id', {
      bucketName: bucketName, // バケット名を定義
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // Create OriginAccessIdentity
    const oai = new cloudfront.OriginAccessIdentity(this, "my-oai");

    // Create Policy and attach to mybucket
    const myBucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["s3:GetObject"],
      principals: [
        new iam.CanonicalUserPrincipal(
          oai.cloudFrontOriginAccessIdentityS3CanonicalUserId
        ),
      ],
      resources: [s3Bucket.bucketArn + "/*"],
    });
    s3Bucket.addToResourcePolicy(myBucketPolicy);

    //**************************************************** */
    // CloudFrontの定義
    //**************************************************** */

    // Create CloudFront WebDistribution
    new cloudfront.CloudFrontWebDistribution(this, "WebsiteDistribution", {
      viewerCertificate: {
        aliases: [],
        props: {
          cloudFrontDefaultCertificate: true,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: s3Bucket,
            originAccessIdentity: oai,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              minTtl: cdk.Duration.seconds(0),
              maxTtl: cdk.Duration.days(365),
              defaultTtl: cdk.Duration.days(1),
              pathPattern: "/*", //ルート直下のファイルを全て参照
            },
          ],
        },
      ],
      errorConfigurations: [
        {
          errorCode: 403,
          responsePagePath: "/index.html",
          responseCode: 200,
          errorCachingMinTtl: 0,
        },
        {
          errorCode: 404,
          responsePagePath: "/index.html",
          responseCode: 200,
          errorCachingMinTtl: 0,
        },
      ],
    });

    //**************************************************** */
    // ビルドプロジェクトの作成
    //**************************************************** */
    const project = new codebuild.PipelineProject(this, 'project', {
      projectName: projectName, 
      description: 'some description',
      environment: {
        // 環境変数をbuildspec.ymlに設定
        environmentVariables: {
          S3_BUCKET_ARN: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: s3Bucket.bucketArn,
          }
        },
      }
    });

    // S3へ資源反映するために、S3FullAccessRoleをcodeBuildへ付与
    project.addToRolePolicy(new iam.PolicyStatement({
      resources: [s3Bucket.bucketArn, s3Bucket.bucketArn + '/*'],
      actions: ['s3:*']
    }
    ));

    // パイプラインの生成
    const sourceOutput = new codepipeline.Artifact();
    //**************************************************** */
    // ソースアクションの作成
    //**************************************************** */

    // CodeCommitリポジトリの作成
    const repo = new codecommit.Repository(this, 'Repository', {
      repositoryName: repositoryName,
      description: 'Some description.', // optional property
    });

    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      repository: repo,
      branch: branch,
      output: sourceOutput,
    });

    //**************************************************** */
    // ビルドアクションの作成
    //**************************************************** */
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project,
      input: sourceOutput,
      outputs: [new codepipeline.Artifact()]
    });

    //**************************************************** */
    // パイプラインの作成
    //**************************************************** */
    new codepipeline.Pipeline(this, 'pipeline', {
      pipelineName: pipelineName,
      stages: [
        {
          stageName: 'Source',
          actions: [
            sourceAction
          ],
        },
        {
          stageName: 'Build',
          actions: [
            buildAction
          ],
        }
      ]
    })

    //**************************************************** */
    // DyanmoDBの作成
    //**************************************************** */
    const table: Table = new Table(this, "your-table-id", {
      partitionKey: {
        name: "id",
        type: AttributeType.NUMBER
      },
      sortKey: {
        name: "password",
        type: AttributeType.STRING
      },
      readCapacity: 1,
      writeCapacity: 1,
      tableName: tableName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    //**************************************************** */
    //LambdaFunctionの作成
    //**************************************************** */
    const yourFunction: Function = new Function(this, 'your-function-id', {
      functionName: yourFunctionName,
      runtime: Runtime.NODEJS_12_X,
      code: AssetCode.fromAsset('src/lambda'),
      handler: 'yourFunction.handler',
      timeout: cdk.Duration.seconds(10),
      environment: {
        TZ: "Asia/Tokyo",
        TABLE_NAME: table.tableName,
        CORS_URL: "*" // 作成したCloudFrontのエンドポイントを指定する
      },
      logRetention: RetentionDays.TWO_MONTHS,
    });

    table.grantFullAccess(yourFunction);

    //**************************************************** */
    // API Gateway（リソース, メソッド）の作成
    //**************************************************** */
    const api = new RestApi(this, "your-first-api-id", {
      restApiName: restApiName,
      cloudWatchRole: true,

    });
    const scanMeeting = api.root.addResource("your-du");

    const scanMeetingLambdaIntegration = new LambdaIntegration(yourFunction);
    scanMeeting.addMethod("POST", scanMeetingLambdaIntegration);
    addCorsOptions(scanMeeting);
  }
}

//**************************************************** */
// API GatewayのメソッドにOPTIONを追加
//**************************************************** */
export function addCorsOptions(apiResource: IResource) {
  apiResource.addMethod(
    "OPTIONS",
    new MockIntegration({
      integrationResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
            "method.response.header.Access-Control-Allow-Origin": "'*'",
            "method.response.header.Access-Control-Allow-Credentials": "'false'",
            "method.response.header.Access-Control-Allow-Methods": "'OPTIONS,GET,PUT,POST,DELETE'",
          },
        },
      ],
      passthroughBehavior: PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{"statusCode": 200}',
      },
    }),
    {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    }
  );
}
