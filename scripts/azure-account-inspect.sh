#!/usr/bin/env bash
# RevenueOS Azure account inspection — paste into Cloud Shell (Bash).
# Safe: read-only except optional provider registration already done.
set -euo pipefail

echo "===== 1) ACTIVE SUBSCRIPTION ====="
az account show -o jsonc

echo
echo "===== 2) ALL SUBSCRIPTIONS ====="
az account list -o table

echo
echo "===== 3) SUBSCRIPTION DETAILS (type/state/quotaId) ====="
SUB=$(az account show --query id -o tsv)
az account subscription show --subscription "$SUB" -o jsonc 2>/dev/null || \
  az rest --method get --url "https://management.azure.com/subscriptions/${SUB}?api-version=2022-12-01" -o jsonc

echo
echo "===== 4) FREE / OFFER HINTS (quotaId + spendingLimit) ====="
az account show --query "{name:name,id:id,state:state,tenantId:tenantId,isDefault:isDefault,user:user.name}" -o jsonc
az rest --method get \
  --url "https://management.azure.com/subscriptions/${SUB}?api-version=2020-01-01" \
  --query "{displayName:displayName,state:state,subscriptionPolicies:subscriptionPolicies,spendingLimit:subscriptionPolicies.spendingLimit,quotaId:subscriptionPolicies.quotaId}" \
  -o jsonc 2>/dev/null || true

echo
echo "===== 5) RESOURCE GROUPS ====="
az group list -o table

echo
echo "===== 6) EXISTING VMs ====="
az vm list -d -o table 2>/dev/null || echo "(none or list failed)"

echo
echo "===== 7) ALL RESOURCES (name/type/rg/location) ====="
az resource list --query "[].{name:name,type:type,rg:resourceGroup,location:location}" -o table 2>/dev/null || true

echo
echo "===== 8) COST MANAGEMENT (may fail on free/student) ====="
az consumption usage list --top 5 -o table 2>/dev/null || echo "consumption usage: unavailable"
az consumption budget list -o table 2>/dev/null || echo "budgets: unavailable"

echo
echo "===== 9) COMPUTE USAGE (cores) — sample regions ====="
for loc in eastus eastus2 westus2 centralus southcentralus northeurope westeurope; do
  echo "--- $loc ---"
  az vm list-usage --location "$loc" \
    --query "[?contains(name.value, 'standardBSFamily') || name.value=='cores' || name.value=='virtualMachines'].{name:name.localizedValue,current:currentValue,limit:limit}" \
    -o table 2>/dev/null || echo "usage failed for $loc"
done

echo
echo "===== 10) Standard_B1s AVAILABILITY BY REGION ====="
# Returns regions where size is listed (not a guarantee of quota)
python3 - <<'PY' 2>/dev/null || true
import json, subprocess, sys
regions = ["eastus","eastus2","westus2","centralus","southcentralus","northeurope","westeurope","canadacentral","uksouth","australiaeast"]
ok=[]
fail=[]
for r in regions:
    try:
        out=subprocess.check_output(["az","vm","list-sizes","--location",r,"--query","[?name=='Standard_B1s'].name","-o","tsv"], text=True, stderr=subprocess.DEVNULL).strip()
        if out:
            ok.append(r)
        else:
            fail.append(r)
    except Exception:
        fail.append(r)
print("B1s_LISTED:", ",".join(ok) if ok else "(none)")
print("B1s_NOT_LISTED:", ",".join(fail) if fail else "(none)")
PY

for loc in eastus eastus2 westus2 centralus southcentralus northeurope westeurope canadacentral; do
  echo -n "$loc: "
  az vm list-skus --location "$loc" --size Standard_B1s --resource-type virtualMachines \
    --query "[0].{name:name,locations:locations[0],restrictions:restrictions}" -o jsonc 2>/dev/null || echo "sku query failed"
done

echo
echo "===== 11) RECOMMENDED CHEAP CREATE PREVIEW (no create) ====="
echo "Planned (NOT created yet):"
echo "  RG: revenueos-prod"
echo "  VM: revenueos-core"
echo "  Size: Standard_B1s"
echo "  Image: Ubuntu2204"
echo "  Disk: StandardSSD_LRS or Standard_LRS (smallest OS disk)"
echo "  Auth: SSH key only"
echo "  Public IP: Standard (SSH/22 only)"
echo "  Expected pay-as-you-go exposure if free hours/credits exhausted: roughly \$8–18/mo (B1s+disk+IP), far under \$70"
echo
echo "===== DONE — paste full output back into Cursor ====="
