# gcloud-vault-action

A GitHub Action to authenticate to gcloud via Vault and then execute a provided script.
This method will take a Vault credential, authenticate to Vault, and get a private SA key from Vault using the provided GCP roleset. It will then will execute the provided script with that credential authenticated in the gcloud SDK. After the closure has been run, the lease on the private SA key in GCP will be revoked using the Vault GCP roleset.

## Inputs for GeneralMills/gcloud-vault-action@v0.1.1

| Parameter       | Required | Info                                         |
| --------------- | -------- | -------------------------------------------- |
| `vaultUrl`      | `true`   | Vault URL                                    |
| `roleId`        | `true`   | RoleId to authenticate to vault with         |
| `secretId`      | `true`   | SecretId associated with the role provided   |
| `rolesetPath`   | `true`   | Path to GCP roleset in vault                 |
| `script`        | `true`   | script to run                                |

## Example

```yaml
uses: GeneralMills/gcloud-vault-action@v0.1.1
    with:
    vaultUrl: ${{ env.VAULT_URL }}
    roleId: ${{ secrets.ROLE_ID }}
    secretId: ${{ secrets.SECRET_ID }}
    rolesetPath: ${{ env.ROLESET_PATH }}
    script: |
        gcloud auth configure-docker gcr.io
```

`script` can execute multiple lines.

## Inputs for GeneralMills/gcloud-vault-action@v0.2.0

| Parameter                         | Required | Info                                                                                   |
| --------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `vaultUrl`                        | `true`   | Vault URL                                                                              |
| `roleId`                          | `true`   | RoleId to authenticate to vault with                                                   |
| `secretId`                        | `true`   | SecretId associated with the role provided                                             |
| `rolesetPath`                     | `true`   | Path to GCP roleset in vault                                                           |
| `setBigQueryBiEngineReservation`  | `false`  | Boolean value to set BI Engine Reservation (default=`'false'`)                         |
| `googleProjectId`                 | `false`  | The google project id for setting the reservation                                      |
| `location`                        | `false`  | Location for setting the reservation and where the data will be stored(default=`'US'`) |
| `reservationBytesInGB`            | `false`  | Size of BI Engine Reservation in GB                                                    |
| `script`                          | `true`   | script to run                                                                          |

## Example

```yaml
uses: GeneralMills/gcloud-vault-action@v0.2.0
with:
    vaultUrl: ${{ env.VAULT_URL }}
    roleId: ${{ secrets.ROLE_ID }}
    secretId: ${{ secrets.SECRET_ID }}
    rolesetPath: ${{ env.ROLESET_PATH }}
    setBigQueryBiEngineReservation: 'true'
    googleProjectId: ${{ env.PROJECT_ID }}
    location: ${{ env.location }}
    reservationBytesInGB: Integer value between 1 and 100
    script: |
        echo 'Setting the BI Engine Reservation'
```

`script` can execute multiple lines.

When `setBigQueryBiEngineReservation` is set to true the github action also expects the `googleProjectId` and `reservationBytesInGB` to be passed as a parameter to the script. The `location` parameter is set to a default value of US (multiple region in United States). If the location needs to be more specific pass an appropriate value e.g (us-west2, us-east4). The `reservationBytesInGB` parameter expects an Integer value, if 1.7 is passed it will treat the value as 1. Setting the value to 0 would delete the BI Engine reservation.
