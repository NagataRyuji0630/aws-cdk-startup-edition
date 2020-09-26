"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCorsOptions = exports.CdkTempleteStartupEditionStack = void 0;
const cdk = require("@aws-cdk/core");
const aws_dynamodb_1 = require("@aws-cdk/aws-dynamodb");
const aws_lambda_1 = require("@aws-cdk/aws-lambda");
const aws_apigateway_1 = require("@aws-cdk/aws-apigateway");
const aws_logs_1 = require("@aws-cdk/aws-logs");
const codecommit = require("@aws-cdk/aws-codecommit");
const codebuild = require("@aws-cdk/aws-codebuild");
const codepipeline = require("@aws-cdk/aws-codepipeline");
const codepipeline_actions = require("@aws-cdk/aws-codepipeline-actions");
const iam = require("@aws-cdk/aws-iam");
const s3 = require("@aws-cdk/aws-s3");
const cloudfront = require("@aws-cdk/aws-cloudfront");
//**************************************************** */
// 変数部分は自由に編集してください。
const stage = "dev"; // "stg","prd"
const bucketName = 'your-web-dev-bucket';
const projectName = 'yourProject-' + stage; // ステージごとにリポジトリを作り分け可能
const repositoryName = 'your-cdk-repository' + stage;
const branch = 'master'; // 'release','master'; 
const pipelineName = 'yourPipeline-' + stage;
const tableName = "YOUR_TABLE";
const yourFunctionName = 'your-function';
const restApiName = 'your-first-api';
//**************************************************** */
class CdkTempleteStartupEditionStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        //**************************************************** */
        // S3バケットの作成
        //**************************************************** */
        const s3Bucket = new s3.Bucket(this, 's3-bucket-id', {
            bucketName: bucketName,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create OriginAccessIdentity
        const oai = new cloudfront.OriginAccessIdentity(this, "my-oai");
        // Create Policy and attach to mybucket
        const myBucketPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            principals: [
                new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId),
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
                            pathPattern: "/*",
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
        }));
        // パイプラインの生成
        const sourceOutput = new codepipeline.Artifact();
        //**************************************************** */
        // ソースアクションの作成
        //**************************************************** */
        // CodeCommitリポジトリの作成
        const repo = new codecommit.Repository(this, 'Repository', {
            repositoryName: repositoryName,
            description: 'Some description.',
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
        });
        //**************************************************** */
        // DyanmoDBの作成
        //**************************************************** */
        const table = new aws_dynamodb_1.Table(this, "your-table-id", {
            partitionKey: {
                name: "id",
                type: aws_dynamodb_1.AttributeType.NUMBER
            },
            sortKey: {
                name: "password",
                type: aws_dynamodb_1.AttributeType.STRING
            },
            readCapacity: 1,
            writeCapacity: 1,
            tableName: tableName,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        //**************************************************** */
        //LambdaFunctionの作成
        //**************************************************** */
        const yourFunction = new aws_lambda_1.Function(this, 'your-function-id', {
            functionName: yourFunctionName,
            runtime: aws_lambda_1.Runtime.NODEJS_12_X,
            code: aws_lambda_1.AssetCode.fromAsset('src/lambda'),
            handler: 'yourFunction.handler',
            timeout: cdk.Duration.seconds(10),
            environment: {
                TZ: "Asia/Tokyo",
                TABLE_NAME: table.tableName,
                CORS_URL: "*" // 作成したCloudFrontのエンドポイントを指定する
            },
            logRetention: aws_logs_1.RetentionDays.TWO_MONTHS,
        });
        table.grantFullAccess(yourFunction);
        //**************************************************** */
        // API Gateway（リソース, メソッド）の作成
        //**************************************************** */
        const api = new aws_apigateway_1.RestApi(this, "your-first-api-id", {
            restApiName: restApiName,
            cloudWatchRole: true,
        });
        const scanMeeting = api.root.addResource("your-du");
        const scanMeetingLambdaIntegration = new aws_apigateway_1.LambdaIntegration(yourFunction);
        scanMeeting.addMethod("POST", scanMeetingLambdaIntegration);
        addCorsOptions(scanMeeting);
    }
}
exports.CdkTempleteStartupEditionStack = CdkTempleteStartupEditionStack;
//**************************************************** */
// API GatewayのメソッドにOPTIONを追加
//**************************************************** */
function addCorsOptions(apiResource) {
    apiResource.addMethod("OPTIONS", new aws_apigateway_1.MockIntegration({
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
        passthroughBehavior: aws_apigateway_1.PassthroughBehavior.NEVER,
        requestTemplates: {
            "application/json": '{"statusCode": 200}',
        },
    }), {
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
    });
}
exports.addCorsOptions = addCorsOptions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLXRlbXBsZXRlLXN0YXJ0dXAtZWRpdGlvbi1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNkay10ZW1wbGV0ZS1zdGFydHVwLWVkaXRpb24tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQXFDO0FBQ3JDLHdEQUE2RDtBQUM3RCxvREFBbUU7QUFDbkUsNERBQXNIO0FBQ3RILGdEQUFrRDtBQUNsRCxzREFBc0Q7QUFDdEQsb0RBQW9EO0FBQ3BELDBEQUEwRDtBQUMxRCwwRUFBMEU7QUFDMUUsd0NBQXdDO0FBQ3hDLHNDQUFzQztBQUN0QyxzREFBc0Q7QUFFdEQseURBQXlEO0FBQ3pELG9CQUFvQjtBQUNwQixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxjQUFjO0FBQ25DLE1BQU0sVUFBVSxHQUFHLHFCQUFxQixDQUFBO0FBQ3hDLE1BQU0sV0FBVyxHQUFHLGNBQWMsR0FBRyxLQUFLLENBQUMsQ0FBQyxzQkFBc0I7QUFDbEUsTUFBTSxjQUFjLEdBQUcscUJBQXFCLEdBQUcsS0FBSyxDQUFDO0FBQ3JELE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxDQUFDLHVCQUF1QjtBQUNoRCxNQUFNLFlBQVksR0FBRyxlQUFlLEdBQUcsS0FBSyxDQUFDO0FBQzdDLE1BQU0sU0FBUyxHQUFHLFlBQVksQ0FBQztBQUMvQixNQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FBQztBQUN6QyxNQUFNLFdBQVcsR0FBRyxnQkFBZ0IsQ0FBQztBQUNyQyx5REFBeUQ7QUFFekQsTUFBYSw4QkFBK0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUMzRCxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLHlEQUF5RDtRQUN6RCxZQUFZO1FBQ1oseURBQXlEO1FBRXpELE1BQU0sUUFBUSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ25ELFVBQVUsRUFBRSxVQUFVO1lBQ3RCLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFBO1FBRUYsOEJBQThCO1FBQzlCLE1BQU0sR0FBRyxHQUFHLElBQUksVUFBVSxDQUFDLG9CQUFvQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUVoRSx1Q0FBdUM7UUFDdkMsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQzdDLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFLENBQUMsY0FBYyxDQUFDO1lBQ3pCLFVBQVUsRUFBRTtnQkFDVixJQUFJLEdBQUcsQ0FBQyxzQkFBc0IsQ0FDNUIsR0FBRyxDQUFDLCtDQUErQyxDQUNwRDthQUNGO1lBQ0QsU0FBUyxFQUFFLENBQUMsUUFBUSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7U0FDdkMsQ0FBQyxDQUFDO1FBQ0gsUUFBUSxDQUFDLG1CQUFtQixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBRTdDLHlEQUF5RDtRQUN6RCxnQkFBZ0I7UUFDaEIseURBQXlEO1FBRXpELG9DQUFvQztRQUNwQyxJQUFJLFVBQVUsQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDcEUsaUJBQWlCLEVBQUU7Z0JBQ2pCLE9BQU8sRUFBRSxFQUFFO2dCQUNYLEtBQUssRUFBRTtvQkFDTCw0QkFBNEIsRUFBRSxJQUFJO2lCQUNuQzthQUNGO1lBQ0QsVUFBVSxFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUU7Z0JBQ2I7b0JBQ0UsY0FBYyxFQUFFO3dCQUNkLGNBQWMsRUFBRSxRQUFRO3dCQUN4QixvQkFBb0IsRUFBRSxHQUFHO3FCQUMxQjtvQkFDRCxTQUFTLEVBQUU7d0JBQ1Q7NEJBQ0UsaUJBQWlCLEVBQUUsSUFBSTs0QkFDdkIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzs0QkFDL0IsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQzs0QkFDOUIsVUFBVSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzs0QkFDaEMsV0FBVyxFQUFFLElBQUk7eUJBQ2xCO3FCQUNGO2lCQUNGO2FBQ0Y7WUFDRCxtQkFBbUIsRUFBRTtnQkFDbkI7b0JBQ0UsU0FBUyxFQUFFLEdBQUc7b0JBQ2QsZ0JBQWdCLEVBQUUsYUFBYTtvQkFDL0IsWUFBWSxFQUFFLEdBQUc7b0JBQ2pCLGtCQUFrQixFQUFFLENBQUM7aUJBQ3RCO2dCQUNEO29CQUNFLFNBQVMsRUFBRSxHQUFHO29CQUNkLGdCQUFnQixFQUFFLGFBQWE7b0JBQy9CLFlBQVksRUFBRSxHQUFHO29CQUNqQixrQkFBa0IsRUFBRSxDQUFDO2lCQUN0QjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgseURBQXlEO1FBQ3pELGVBQWU7UUFDZix5REFBeUQ7UUFDekQsTUFBTSxPQUFPLEdBQUcsSUFBSSxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUU7WUFDN0QsV0FBVyxFQUFFLFdBQVc7WUFDeEIsV0FBVyxFQUFFLGtCQUFrQjtZQUMvQixXQUFXLEVBQUU7Z0JBQ1gsd0JBQXdCO2dCQUN4QixvQkFBb0IsRUFBRTtvQkFDcEIsYUFBYSxFQUFFO3dCQUNiLElBQUksRUFBRSxTQUFTLENBQUMsNEJBQTRCLENBQUMsU0FBUzt3QkFDdEQsS0FBSyxFQUFFLFFBQVEsQ0FBQyxTQUFTO3FCQUMxQjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsNkNBQTZDO1FBQzdDLE9BQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQzlDLFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7WUFDMUQsT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDO1NBQ2xCLENBQ0EsQ0FBQyxDQUFDO1FBRUgsWUFBWTtRQUNaLE1BQU0sWUFBWSxHQUFHLElBQUksWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2pELHlEQUF5RDtRQUN6RCxjQUFjO1FBQ2QseURBQXlEO1FBRXpELHFCQUFxQjtRQUNyQixNQUFNLElBQUksR0FBRyxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUN6RCxjQUFjLEVBQUUsY0FBYztZQUM5QixXQUFXLEVBQUUsbUJBQW1CO1NBQ2pDLENBQUMsQ0FBQztRQUVILE1BQU0sWUFBWSxHQUFHLElBQUksb0JBQW9CLENBQUMsc0JBQXNCLENBQUM7WUFDbkUsVUFBVSxFQUFFLFlBQVk7WUFDeEIsVUFBVSxFQUFFLElBQUk7WUFDaEIsTUFBTSxFQUFFLE1BQU07WUFDZCxNQUFNLEVBQUUsWUFBWTtTQUNyQixDQUFDLENBQUM7UUFFSCx5REFBeUQ7UUFDekQsY0FBYztRQUNkLHlEQUF5RDtRQUN6RCxNQUFNLFdBQVcsR0FBRyxJQUFJLG9CQUFvQixDQUFDLGVBQWUsQ0FBQztZQUMzRCxVQUFVLEVBQUUsV0FBVztZQUN2QixPQUFPO1lBQ1AsS0FBSyxFQUFFLFlBQVk7WUFDbkIsT0FBTyxFQUFFLENBQUMsSUFBSSxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7U0FDdkMsQ0FBQyxDQUFDO1FBRUgseURBQXlEO1FBQ3pELFlBQVk7UUFDWix5REFBeUQ7UUFDekQsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDMUMsWUFBWSxFQUFFLFlBQVk7WUFDMUIsTUFBTSxFQUFFO2dCQUNOO29CQUNFLFNBQVMsRUFBRSxRQUFRO29CQUNuQixPQUFPLEVBQUU7d0JBQ1AsWUFBWTtxQkFDYjtpQkFDRjtnQkFDRDtvQkFDRSxTQUFTLEVBQUUsT0FBTztvQkFDbEIsT0FBTyxFQUFFO3dCQUNQLFdBQVc7cUJBQ1o7aUJBQ0Y7YUFDRjtTQUNGLENBQUMsQ0FBQTtRQUVGLHlEQUF5RDtRQUN6RCxjQUFjO1FBQ2QseURBQXlEO1FBQ3pELE1BQU0sS0FBSyxHQUFVLElBQUksb0JBQUssQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3BELFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsSUFBSTtnQkFDVixJQUFJLEVBQUUsNEJBQWEsQ0FBQyxNQUFNO2FBQzNCO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxVQUFVO2dCQUNoQixJQUFJLEVBQUUsNEJBQWEsQ0FBQyxNQUFNO2FBQzNCO1lBQ0QsWUFBWSxFQUFFLENBQUM7WUFDZixhQUFhLEVBQUUsQ0FBQztZQUNoQixTQUFTLEVBQUUsU0FBUztZQUNwQixhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUVILHlEQUF5RDtRQUN6RCxtQkFBbUI7UUFDbkIseURBQXlEO1FBQ3pELE1BQU0sWUFBWSxHQUFhLElBQUkscUJBQVEsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDcEUsWUFBWSxFQUFFLGdCQUFnQjtZQUM5QixPQUFPLEVBQUUsb0JBQU8sQ0FBQyxXQUFXO1lBQzVCLElBQUksRUFBRSxzQkFBUyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUM7WUFDdkMsT0FBTyxFQUFFLHNCQUFzQjtZQUMvQixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFdBQVcsRUFBRTtnQkFDWCxFQUFFLEVBQUUsWUFBWTtnQkFDaEIsVUFBVSxFQUFFLEtBQUssQ0FBQyxTQUFTO2dCQUMzQixRQUFRLEVBQUUsR0FBRyxDQUFDLDhCQUE4QjthQUM3QztZQUNELFlBQVksRUFBRSx3QkFBYSxDQUFDLFVBQVU7U0FDdkMsQ0FBQyxDQUFDO1FBRUgsS0FBSyxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUVwQyx5REFBeUQ7UUFDekQsNkJBQTZCO1FBQzdCLHlEQUF5RDtRQUN6RCxNQUFNLEdBQUcsR0FBRyxJQUFJLHdCQUFPLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ2pELFdBQVcsRUFBRSxXQUFXO1lBQ3hCLGNBQWMsRUFBRSxJQUFJO1NBRXJCLENBQUMsQ0FBQztRQUNILE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRXBELE1BQU0sNEJBQTRCLEdBQUcsSUFBSSxrQ0FBaUIsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN6RSxXQUFXLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSw0QkFBNEIsQ0FBQyxDQUFDO1FBQzVELGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM5QixDQUFDO0NBQ0Y7QUF4TUQsd0VBd01DO0FBRUQseURBQXlEO0FBQ3pELDZCQUE2QjtBQUM3Qix5REFBeUQ7QUFDekQsU0FBZ0IsY0FBYyxDQUFDLFdBQXNCO0lBQ25ELFdBQVcsQ0FBQyxTQUFTLENBQ25CLFNBQVMsRUFDVCxJQUFJLGdDQUFlLENBQUM7UUFDbEIsb0JBQW9CLEVBQUU7WUFDcEI7Z0JBQ0UsVUFBVSxFQUFFLEtBQUs7Z0JBQ2pCLGtCQUFrQixFQUFFO29CQUNsQixxREFBcUQsRUFBRSx5RkFBeUY7b0JBQ2hKLG9EQUFvRCxFQUFFLEtBQUs7b0JBQzNELHlEQUF5RCxFQUFFLFNBQVM7b0JBQ3BFLHFEQUFxRCxFQUFFLCtCQUErQjtpQkFDdkY7YUFDRjtTQUNGO1FBQ0QsbUJBQW1CLEVBQUUsb0NBQW1CLENBQUMsS0FBSztRQUM5QyxnQkFBZ0IsRUFBRTtZQUNoQixrQkFBa0IsRUFBRSxxQkFBcUI7U0FDMUM7S0FDRixDQUFDLEVBQ0Y7UUFDRSxlQUFlLEVBQUU7WUFDZjtnQkFDRSxVQUFVLEVBQUUsS0FBSztnQkFDakIsa0JBQWtCLEVBQUU7b0JBQ2xCLHFEQUFxRCxFQUFFLElBQUk7b0JBQzNELHFEQUFxRCxFQUFFLElBQUk7b0JBQzNELHlEQUF5RCxFQUFFLElBQUk7b0JBQy9ELG9EQUFvRCxFQUFFLElBQUk7aUJBQzNEO2FBQ0Y7U0FDRjtLQUNGLENBQ0YsQ0FBQztBQUNKLENBQUM7QUFsQ0Qsd0NBa0NDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuaW1wb3J0IHsgVGFibGUsIEF0dHJpYnV0ZVR5cGUgfSBmcm9tIFwiQGF3cy1jZGsvYXdzLWR5bmFtb2RiXCI7XG5pbXBvcnQgeyBGdW5jdGlvbiwgQXNzZXRDb2RlLCBSdW50aW1lIH0gZnJvbSAnQGF3cy1jZGsvYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBSZXN0QXBpLCBMYW1iZGFJbnRlZ3JhdGlvbiwgSVJlc291cmNlLCBNb2NrSW50ZWdyYXRpb24sIFBhc3N0aHJvdWdoQmVoYXZpb3IgfSBmcm9tIFwiQGF3cy1jZGsvYXdzLWFwaWdhdGV3YXlcIjtcbmltcG9ydCB7IFJldGVudGlvbkRheXMgfSBmcm9tICdAYXdzLWNkay9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBjb2RlY29tbWl0IGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2RlY29tbWl0JztcbmltcG9ydCAqIGFzIGNvZGVidWlsZCBmcm9tICdAYXdzLWNkay9hd3MtY29kZWJ1aWxkJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZSBmcm9tICdAYXdzLWNkay9hd3MtY29kZXBpcGVsaW5lJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZV9hY3Rpb25zIGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2RlcGlwZWxpbmUtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdAYXdzLWNkay9hd3MtczMnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdAYXdzLWNkay9hd3MtY2xvdWRmcm9udCc7XG5cbi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuLy8g5aSJ5pWw6YOo5YiG44Gv6Ieq55Sx44Gr57eo6ZuG44GX44Gm44GP44Gg44GV44GE44CCXG5jb25zdCBzdGFnZSA9IFwiZGV2XCI7IC8vIFwic3RnXCIsXCJwcmRcIlxuY29uc3QgYnVja2V0TmFtZSA9ICd5b3VyLXdlYi1kZXYtYnVja2V0J1xuY29uc3QgcHJvamVjdE5hbWUgPSAneW91clByb2plY3QtJyArIHN0YWdlOyAvLyDjgrnjg4bjg7zjgrjjgZTjgajjgavjg6rjg53jgrjjg4jjg6rjgpLkvZzjgorliIbjgZHlj6/og71cbmNvbnN0IHJlcG9zaXRvcnlOYW1lID0gJ3lvdXItY2RrLXJlcG9zaXRvcnknICsgc3RhZ2U7XG5jb25zdCBicmFuY2ggPSAnbWFzdGVyJzsgLy8gJ3JlbGVhc2UnLCdtYXN0ZXInOyBcbmNvbnN0IHBpcGVsaW5lTmFtZSA9ICd5b3VyUGlwZWxpbmUtJyArIHN0YWdlO1xuY29uc3QgdGFibGVOYW1lID0gXCJZT1VSX1RBQkxFXCI7XG5jb25zdCB5b3VyRnVuY3Rpb25OYW1lID0gJ3lvdXItZnVuY3Rpb24nO1xuY29uc3QgcmVzdEFwaU5hbWUgPSAneW91ci1maXJzdC1hcGknO1xuLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cbmV4cG9ydCBjbGFzcyBDZGtUZW1wbGV0ZVN0YXJ0dXBFZGl0aW9uU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkNvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG4gICAgLy8gUzPjg5DjgrHjg4Pjg4jjga7kvZzmiJBcbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuICAgIGNvbnN0IHMzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnczMtYnVja2V0LWlkJywge1xuICAgICAgYnVja2V0TmFtZTogYnVja2V0TmFtZSwgLy8g44OQ44Kx44OD44OI5ZCN44KS5a6a576pXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pXG5cbiAgICAvLyBDcmVhdGUgT3JpZ2luQWNjZXNzSWRlbnRpdHlcbiAgICBjb25zdCBvYWkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eSh0aGlzLCBcIm15LW9haVwiKTtcblxuICAgIC8vIENyZWF0ZSBQb2xpY3kgYW5kIGF0dGFjaCB0byBteWJ1Y2tldFxuICAgIGNvbnN0IG15QnVja2V0UG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1wiczM6R2V0T2JqZWN0XCJdLFxuICAgICAgcHJpbmNpcGFsczogW1xuICAgICAgICBuZXcgaWFtLkNhbm9uaWNhbFVzZXJQcmluY2lwYWwoXG4gICAgICAgICAgb2FpLmNsb3VkRnJvbnRPcmlnaW5BY2Nlc3NJZGVudGl0eVMzQ2Fub25pY2FsVXNlcklkXG4gICAgICAgICksXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbczNCdWNrZXQuYnVja2V0QXJuICsgXCIvKlwiXSxcbiAgICB9KTtcbiAgICBzM0J1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KG15QnVja2V0UG9saWN5KTtcblxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIC8vIENsb3VkRnJvbnTjga7lrprnvqlcbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuICAgIC8vIENyZWF0ZSBDbG91ZEZyb250IFdlYkRpc3RyaWJ1dGlvblxuICAgIG5ldyBjbG91ZGZyb250LkNsb3VkRnJvbnRXZWJEaXN0cmlidXRpb24odGhpcywgXCJXZWJzaXRlRGlzdHJpYnV0aW9uXCIsIHtcbiAgICAgIHZpZXdlckNlcnRpZmljYXRlOiB7XG4gICAgICAgIGFsaWFzZXM6IFtdLFxuICAgICAgICBwcm9wczoge1xuICAgICAgICAgIGNsb3VkRnJvbnREZWZhdWx0Q2VydGlmaWNhdGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcHJpY2VDbGFzczogY2xvdWRmcm9udC5QcmljZUNsYXNzLlBSSUNFX0NMQVNTX0FMTCxcbiAgICAgIG9yaWdpbkNvbmZpZ3M6IFtcbiAgICAgICAge1xuICAgICAgICAgIHMzT3JpZ2luU291cmNlOiB7XG4gICAgICAgICAgICBzM0J1Y2tldFNvdXJjZTogczNCdWNrZXQsXG4gICAgICAgICAgICBvcmlnaW5BY2Nlc3NJZGVudGl0eTogb2FpLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYmVoYXZpb3JzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGlzRGVmYXVsdEJlaGF2aW9yOiB0cnVlLFxuICAgICAgICAgICAgICBtaW5UdGw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDApLFxuICAgICAgICAgICAgICBtYXhUdGw6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICAgIGRlZmF1bHRUdGw6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICAgICAgICBwYXRoUGF0dGVybjogXCIvKlwiLCAvL+ODq+ODvOODiOebtOS4i+OBruODleOCoeOCpOODq+OCkuWFqOOBpuWPgueFp1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGVycm9yQ29uZmlndXJhdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGVycm9yQ29kZTogNDAzLFxuICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6IFwiL2luZGV4Lmh0bWxcIixcbiAgICAgICAgICByZXNwb25zZUNvZGU6IDIwMCxcbiAgICAgICAgICBlcnJvckNhY2hpbmdNaW5UdGw6IDAsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBlcnJvckNvZGU6IDQwNCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiBcIi9pbmRleC5odG1sXCIsXG4gICAgICAgICAgcmVzcG9uc2VDb2RlOiAyMDAsXG4gICAgICAgICAgZXJyb3JDYWNoaW5nTWluVHRsOiAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIC8vIOODk+ODq+ODieODl+ODreOCuOOCp+OCr+ODiOOBruS9nOaIkFxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIGNvbnN0IHByb2plY3QgPSBuZXcgY29kZWJ1aWxkLlBpcGVsaW5lUHJvamVjdCh0aGlzLCAncHJvamVjdCcsIHtcbiAgICAgIHByb2plY3ROYW1lOiBwcm9qZWN0TmFtZSwgXG4gICAgICBkZXNjcmlwdGlvbjogJ3NvbWUgZGVzY3JpcHRpb24nLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLy8g55Kw5aKD5aSJ5pWw44KSYnVpbGRzcGVjLnltbOOBq+ioreWumlxuICAgICAgICBlbnZpcm9ubWVudFZhcmlhYmxlczoge1xuICAgICAgICAgIFMzX0JVQ0tFVF9BUk46IHtcbiAgICAgICAgICAgIHR5cGU6IGNvZGVidWlsZC5CdWlsZEVudmlyb25tZW50VmFyaWFibGVUeXBlLlBMQUlOVEVYVCxcbiAgICAgICAgICAgIHZhbHVlOiBzM0J1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gUzPjgbjos4fmupDlj43mmKDjgZnjgovjgZ/jgoHjgavjgIFTM0Z1bGxBY2Nlc3NSb2xl44KSY29kZUJ1aWxk44G45LuY5LiOXG4gICAgcHJvamVjdC5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgcmVzb3VyY2VzOiBbczNCdWNrZXQuYnVja2V0QXJuLCBzM0J1Y2tldC5idWNrZXRBcm4gKyAnLyonXSxcbiAgICAgIGFjdGlvbnM6IFsnczM6KiddXG4gICAgfVxuICAgICkpO1xuXG4gICAgLy8g44OR44Kk44OX44Op44Kk44Oz44Gu55Sf5oiQXG4gICAgY29uc3Qgc291cmNlT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgpO1xuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIC8vIOOCveODvOOCueOCouOCr+OCt+ODp+ODs+OBruS9nOaIkFxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG4gICAgLy8gQ29kZUNvbW1pdOODquODneOCuOODiOODquOBruS9nOaIkFxuICAgIGNvbnN0IHJlcG8gPSBuZXcgY29kZWNvbW1pdC5SZXBvc2l0b3J5KHRoaXMsICdSZXBvc2l0b3J5Jywge1xuICAgICAgcmVwb3NpdG9yeU5hbWU6IHJlcG9zaXRvcnlOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTb21lIGRlc2NyaXB0aW9uLicsIC8vIG9wdGlvbmFsIHByb3BlcnR5XG4gICAgfSk7XG5cbiAgICBjb25zdCBzb3VyY2VBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZUNvbW1pdFNvdXJjZUFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnQ29kZUNvbW1pdCcsXG4gICAgICByZXBvc2l0b3J5OiByZXBvLFxuICAgICAgYnJhbmNoOiBicmFuY2gsXG4gICAgICBvdXRwdXQ6IHNvdXJjZU91dHB1dCxcbiAgICB9KTtcblxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIC8vIOODk+ODq+ODieOCouOCr+OCt+ODp+ODs+OBruS9nOaIkFxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIGNvbnN0IGJ1aWxkQWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkNvZGVCdWlsZEFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnQ29kZUJ1aWxkJyxcbiAgICAgIHByb2plY3QsXG4gICAgICBpbnB1dDogc291cmNlT3V0cHV0LFxuICAgICAgb3V0cHV0czogW25ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKV1cbiAgICB9KTtcblxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIC8vIOODkeOCpOODl+ODqeOCpOODs+OBruS9nOaIkFxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIG5ldyBjb2RlcGlwZWxpbmUuUGlwZWxpbmUodGhpcywgJ3BpcGVsaW5lJywge1xuICAgICAgcGlwZWxpbmVOYW1lOiBwaXBlbGluZU5hbWUsXG4gICAgICBzdGFnZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHN0YWdlTmFtZTogJ1NvdXJjZScsXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgc291cmNlQWN0aW9uXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YWdlTmFtZTogJ0J1aWxkJyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICBidWlsZEFjdGlvblxuICAgICAgICAgIF0sXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KVxuXG4gICAgLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG4gICAgLy8gRHlhbm1vRELjga7kvZzmiJBcbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbiAgICBjb25zdCB0YWJsZTogVGFibGUgPSBuZXcgVGFibGUodGhpcywgXCJ5b3VyLXRhYmxlLWlkXCIsIHtcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiBcImlkXCIsXG4gICAgICAgIHR5cGU6IEF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiBcInBhc3N3b3JkXCIsXG4gICAgICAgIHR5cGU6IEF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgcmVhZENhcGFjaXR5OiAxLFxuICAgICAgd3JpdGVDYXBhY2l0eTogMSxcbiAgICAgIHRhYmxlTmFtZTogdGFibGVOYW1lLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIC8vTGFtYmRhRnVuY3Rpb27jga7kvZzmiJBcbiAgICAvLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbiAgICBjb25zdCB5b3VyRnVuY3Rpb246IEZ1bmN0aW9uID0gbmV3IEZ1bmN0aW9uKHRoaXMsICd5b3VyLWZ1bmN0aW9uLWlkJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiB5b3VyRnVuY3Rpb25OYW1lLFxuICAgICAgcnVudGltZTogUnVudGltZS5OT0RFSlNfMTJfWCxcbiAgICAgIGNvZGU6IEFzc2V0Q29kZS5mcm9tQXNzZXQoJ3NyYy9sYW1iZGEnKSxcbiAgICAgIGhhbmRsZXI6ICd5b3VyRnVuY3Rpb24uaGFuZGxlcicsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBUWjogXCJBc2lhL1Rva3lvXCIsXG4gICAgICAgIFRBQkxFX05BTUU6IHRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQ09SU19VUkw6IFwiKlwiIC8vIOS9nOaIkOOBl+OBn0Nsb3VkRnJvbnTjga7jgqjjg7Pjg4njg53jgqTjg7Pjg4jjgpLmjIflrprjgZnjgotcbiAgICAgIH0sXG4gICAgICBsb2dSZXRlbnRpb246IFJldGVudGlvbkRheXMuVFdPX01PTlRIUyxcbiAgICB9KTtcblxuICAgIHRhYmxlLmdyYW50RnVsbEFjY2Vzcyh5b3VyRnVuY3Rpb24pO1xuXG4gICAgLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG4gICAgLy8gQVBJIEdhdGV3YXnvvIjjg6rjgr3jg7zjgrksIOODoeOCveODg+ODie+8ieOBruS9nOaIkFxuICAgIC8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIGNvbnN0IGFwaSA9IG5ldyBSZXN0QXBpKHRoaXMsIFwieW91ci1maXJzdC1hcGktaWRcIiwge1xuICAgICAgcmVzdEFwaU5hbWU6IHJlc3RBcGlOYW1lLFxuICAgICAgY2xvdWRXYXRjaFJvbGU6IHRydWUsXG5cbiAgICB9KTtcbiAgICBjb25zdCBzY2FuTWVldGluZyA9IGFwaS5yb290LmFkZFJlc291cmNlKFwieW91ci1kdVwiKTtcblxuICAgIGNvbnN0IHNjYW5NZWV0aW5nTGFtYmRhSW50ZWdyYXRpb24gPSBuZXcgTGFtYmRhSW50ZWdyYXRpb24oeW91ckZ1bmN0aW9uKTtcbiAgICBzY2FuTWVldGluZy5hZGRNZXRob2QoXCJQT1NUXCIsIHNjYW5NZWV0aW5nTGFtYmRhSW50ZWdyYXRpb24pO1xuICAgIGFkZENvcnNPcHRpb25zKHNjYW5NZWV0aW5nKTtcbiAgfVxufVxuXG4vLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbi8vIEFQSSBHYXRld2F544Gu44Oh44K944OD44OJ44GrT1BUSU9O44KS6L+95YqgXG4vLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbmV4cG9ydCBmdW5jdGlvbiBhZGRDb3JzT3B0aW9ucyhhcGlSZXNvdXJjZTogSVJlc291cmNlKSB7XG4gIGFwaVJlc291cmNlLmFkZE1ldGhvZChcbiAgICBcIk9QVElPTlNcIixcbiAgICBuZXcgTW9ja0ludGVncmF0aW9uKHtcbiAgICAgIGludGVncmF0aW9uUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiBcIjIwMFwiLFxuICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgXCJtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4sWC1BbXotVXNlci1BZ2VudCdcIixcbiAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogXCInKidcIixcbiAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1DcmVkZW50aWFsc1wiOiBcIidmYWxzZSdcIixcbiAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6IFwiJ09QVElPTlMsR0VULFBVVCxQT1NULERFTEVURSdcIixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6IFBhc3N0aHJvdWdoQmVoYXZpb3IuTkVWRVIsXG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgIFwiYXBwbGljYXRpb24vanNvblwiOiAne1wic3RhdHVzQ29kZVwiOiAyMDB9JyxcbiAgICAgIH0sXG4gICAgfSksXG4gICAge1xuICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiBcIjIwMFwiLFxuICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgXCJtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnNcIjogdHJ1ZSxcbiAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzXCI6IHRydWUsXG4gICAgICAgICAgICBcIm1ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctQ3JlZGVudGlhbHNcIjogdHJ1ZSxcbiAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW5cIjogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9XG4gICk7XG59XG4iXX0=