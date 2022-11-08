const core = require("@actions/core");
const request  = require('./httpClient');
const fs = require('fs');
const { execSync } = require("child_process");

async function main() {

  // inputs from action
  const vaultUrl = core.getInput('vaultUrl', { required: true });
  const roleId = core.getInput('roleId', { required: true });
  const secretId = core.getInput('secretId', { required: true });
  const rolesetPath = core.getInput('rolesetPath', { required: true });
  const setBigQueryBiEngineReservation = core.getInput('setBigQueryBiEngineReservation', { required: false }).toString().toLowerCase() === 'true';
  const googleProjectId = core.getInput('googleProjectId', { required: false });
  const location = core.getInput('location', { required: false });
  const reservationBytesInGB = core.getInput('reservationBytesInGB', { required: false });
  const printScriptOutput = core.getInput('printScriptOutput', { required: false }).toString().toLowerCase() === 'true';
  const script = core.getInput('script', { required: true });

  const vaultAuthPayload = `{"role_id": "${roleId}", "secret_id": "${secretId}"}`;

  // authenticate to vault
  var vaultToken = await getVaultToken(vaultUrl, vaultAuthPayload);
  var { leaseId, key } = await getLeaseAndKey(vaultUrl, rolesetPath, vaultToken);

  try {

    // add service account private key json file to container 
    fs.writeFileSync('sa-key.json', key, (error) => {
      if (error) throw error;
    });

    // provide service account private key json file to client libraries
    // https://cloud.google.com/bigquery/docs/reference/libraries#setting_up_authentication
    process.env.GOOGLE_APPLICATION_CREDENTIALS = './sa-key.json';

    // auth to GCP with service account
    execSync('gcloud auth activate-service-account --key-file sa-key.json');

    // execute provided script
    const execSyncOptions = { stdio: printScriptOutput ? 'inherit' : undefined };
    console.log(`Executing script: ${script}`);
    execSync(script, execSyncOptions);

    //if setBigQueryBiEngineReservation is true set the BI Engine Reservation
    if (setBigQueryBiEngineReservation) {
      const access_token = execSync('gcloud auth print-access-token').toString().replace(/\r?\n|\r/g, '');
      var currentReservation = getBigQueryBIEngineReservation(googleProjectId, location, access_token)
      console.log(`Current Reservation Size is: ${(currentReservation / 1024 / 1024 / 1024)} Gb`)
      
      setBigQueryBIEngineReservation(googleProjectId, location, access_token, reservationBytesInGB)
    }
    
    // delete key json file
    fs.unlinkSync('sa-key.json', (error) => {
      if (error) throw error;
    });

  } catch (error) {
    core.setFailed(error.message);
  } finally {
    // release service account
    await revokeLease(vaultUrl, leaseId, vaultToken);
  }
}

async function getVaultToken(vaultUrl, vaultAuthPayload) {
  console.log(`Authenticating to vault`);
  const authResponse = await request(
    `${vaultUrl}/v1/auth/approle/login`,
    "POST",
    vaultAuthPayload,
    ""
  );

  var statusCode = authResponse.status;
  if (statusCode >= 400) {
    core.setFailed(`Failed to login via the provided approle with status code: ${statusCode}`);
    process.exit(1);
  }

  var data = authResponse.data;
  return data.auth.client_token;
}

async function getLeaseAndKey(vaultUrl, rolesetPath, vaultToken) {
  console.log(`Activating service account`);
  const serviceAccountResponse = await request(
    `${vaultUrl}/v1/${rolesetPath}`,
    "GET",
    "",
    { 'X-Vault-Token': vaultToken }
  );

  var statusCode = serviceAccountResponse.status;
  if (statusCode >= 400) {
    core.setFailed(`Failed to access provided roleset path with status code: ${statusCode}`);
    process.exit(1);
  }

  var saData = serviceAccountResponse.data;
  var key = Buffer.from(saData.data.private_key_data, 'base64');
  var leaseId = saData.lease_id;
  return { leaseId, key };
}

async function revokeLease(vaultUrl, leaseId, vaultToken) {
  console.log(`Revoking lease ${leaseId}`);
  const revokeResponse = await request(
    `${vaultUrl}/v1/sys/leases/revoke`,
    "PUT",
    `{"lease_id": "${leaseId}"}`,
    { 'X-Vault-Token': vaultToken }
  );

  var statusCode = revokeResponse.status;
  if (statusCode == 204) {
    console.log(`Successfully revoked lease: ${leaseId}`);
  }
  else {
    // technically the entire script still executed, but the lease is still hanging around, so don't fail the whole run
    console.log(`Failed to revoke key with ${statusCode} on lease: ${leaseId}`);
  }
}

function getBigQueryBIEngineReservation(googleProjectId, location, accessToken) {
  console.log("Getting the current BI Engine Reservation Value");
  var curl_reqest = `curl https://bigqueryreservation.googleapis.com/v1/projects/${googleProjectId}/locations/${location}/biReservation \
  --header "Authorization: Bearer ${accessToken}"`;
  var response = execSync(curl_reqest).toString();
  var currentSize = parseInt(JSON.parse(response)["size"])
  return currentSize
}

function setBigQueryBIEngineReservation(googleProjectId, location, accessToken, reservationBytesInGB) {
  console.log(`Setting the BI Engine Reservation Value to ${reservationBytesInGB} Gb`);
  var expectedSizeInBytes = parseInt(reservationBytesInGB) * 1024 * 1024 * 1024;
  var curl_reqest = `curl --request PATCH \
  --url https://bigqueryreservation.googleapis.com/v1/projects/${googleProjectId}/locations/${location}/biReservation \
  --header "Authorization: Bearer ${accessToken}" --header "Content-Type: application/json" \
  --data '{"name":"projects/${googleProjectId}/locations/${location}/biReservation", "size": ${expectedSizeInBytes}}'`;
  var response = execSync(curl_reqest).toString();
  var sizeSet = parseInt(JSON.parse(response)["size"])
  console.log(`New Reservation Size is: ${(sizeSet / 1024 / 1024 / 1024)} Gb`)
}

main();
