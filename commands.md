firebase deploy --only functions:triggerBirthdayCampaign,functions:triggerWelcomeCampaign,functions:triggerReactivationCampaign,functions:triggerLoyaltyCampaign

curl -X POST https://us-central1-semantc-ai.cloudfunctions.net/triggerBirthdayCampaign \
  -H "Content-Type: application/json" \
  -d '{"userId": "UYL7W9kaSsYFIFMPzbJoYoHADb33"}'

curl -X POST https://us-central1-semantc-ai.cloudfunctions.net/triggerWelcomeCampaign \
  -H "Content-Type: application/json" \
  -d '{"userId": "UYL7W9kaSsYFIFMPzbJoYoHADb33"}'

curl -X POST https://us-central1-semantc-ai.cloudfunctions.net/triggerReactivationCampaign \
  -H "Content-Type: application/json" \
  -d '{"userId": "UYL7W9kaSsYFIFMPzbJoYoHADb33"}'

curl -X POST https://us-central1-semantc-ai.cloudfunctions.net/triggerLoyaltyCampaign \
  -H "Content-Type: application/json" \
  -d '{"userId": "UYL7W9kaSsYFIFMPzbJoYoHADb33"}'