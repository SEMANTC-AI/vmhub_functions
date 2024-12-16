firebase deploy --only functions:triggerBirthdayCampaign

curl -X POST https://us-central1-semantc-ai.cloudfunctions.net/triggerBirthdayCampaign \
  -H "Content-Type: application/json" \
  -d '{"userId": "UYL7W9kaSsYFIFMPzbJoYoHADb33"}'