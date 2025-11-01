## Troubleshooting Guide

### CloudFormation Deployment Fails

1. **Check stack events:** `aws cloudformation describe-stack-events --stack-name <name>`
2. **Look for failed resources:** Filter by `CREATE_FAILED` or `UPDATE_FAILED`
3. **Read failure reason:** Check `ResourceStatusReason` field
4. **Common causes:**
   - IAM permission issues
   - Resource limits exceeded
   - Invalid parameters
   - Resource naming conflicts

### GitHub Actions Workflow Fails

1. **View workflow run:** `gh run view <run-id>`
2. **Check logs:** `gh run view <run-id> --log`
3. **Look for errors:** Grep for "error", "failed", "exception"
4. **Common causes:**
   - Missing secrets/environment variables
   - AWS credential issues
   - CloudFormation template errors
   - Timeout issues

### Pipeline Stuck

1. **Check pipeline state:** `aws codepipeline get-pipeline-state`
2. **Look for manual approval:** Check if approval action is waiting
3. **Review stage details:** Check which stage is stuck
4. **Check logs:** Review CloudFormation/CodeBuild logs for stuck stage

