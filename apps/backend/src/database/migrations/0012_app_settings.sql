CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" varchar(100) PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

INSERT INTO "app_settings" ("key", "value") VALUES (
  'pricing',
  '{"monthlyPriceCents":999,"annualPriceCents":9599,"monthlyPriceLabel":"$9.99/month","annualPriceLabel":"$95.99/year","annualSavePercent":20,"trialDays":7,"stripePriceIdMonthly":"","stripePriceIdAnnual":"","tierLimits":{"free":{"maxQrCodes":5,"maxGuardians":2,"maxEmergencyContacts":3,"maxPinsPerDay":5},"basic":{"maxQrCodes":10,"maxGuardians":5,"maxEmergencyContacts":10,"maxPinsPerDay":20},"premium":{"maxQrCodes":50,"maxGuardians":20,"maxEmergencyContacts":25,"maxPinsPerDay":100}}}'
) ON CONFLICT ("key") DO NOTHING;
