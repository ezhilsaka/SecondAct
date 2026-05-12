import { SupportedCurrency } from "@prisma/client";

import { prisma } from "@/db/prisma/client";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_NAME = "Phase 1 Demo Portfolio";

interface HoldingSeed {
  ticker: string;
  securityName: string;
  securityCurrency: SupportedCurrency;
  quantity: string;
  averageCost: string;
}

const HOLDINGS: HoldingSeed[] = [
  { ticker: "AQN",  securityName: "Algonquin Power & Utilities Corp",              securityCurrency: SupportedCurrency.CAD, quantity: "50.0000000000",     averageCost: "10.49300000" },
  { ticker: "ZDV",  securityName: "BMO Canadian Dividend ETF CAD Units",            securityCurrency: SupportedCurrency.CAD, quantity: "10.0000000000",     averageCost: "22.17900000" },
  { ticker: "ZEB",  securityName: "BMO Equal Weight Banks Indx ETF CAD Units",      securityCurrency: SupportedCurrency.CAD, quantity: "5.0000000000",      averageCost: "32.69400000" },
  { ticker: "BAM",  securityName: "Brookfield Asset Mgmt Ltd Cl A Ltd Vtg Shs",     securityCurrency: SupportedCurrency.CAD, quantity: "5.0000000000",      averageCost: "95.81800000" },
  { ticker: "BN",   securityName: "Brookfield Corp Vtg Shs Cl A",                   securityCurrency: SupportedCurrency.CAD, quantity: "35.0000000000",     averageCost: "39.98114286" },
  { ticker: "BCE",  securityName: "BCE Inc Com New",                                securityCurrency: SupportedCurrency.CAD, quantity: "52.0000000000",     averageCost: "41.86653846" },
  { ticker: "CNR",  securityName: "Canadian National Railway Co",                    securityCurrency: SupportedCurrency.CAD, quantity: "15.0000000000",     averageCost: "140.88266670" },
  { ticker: "CLX",  securityName: "Clorox Co",                                      securityCurrency: SupportedCurrency.CAD, quantity: "10.0000000000",     averageCost: "158.08400000" },
  { ticker: "DOL",  securityName: "Dollarama Inc",                                  securityCurrency: SupportedCurrency.CAD, quantity: "5.0000000000",      averageCost: "185.87000000" },
  { ticker: "XQQ",  securityName: "iShares Nasdaq 100 Index ETF CAD Hedged",        securityCurrency: SupportedCurrency.CAD, quantity: "2.0000000000",      averageCost: "53.09500000" },
  { ticker: "QQQ",  securityName: "Invesco QQQ Tr Unit Ser 1",                      securityCurrency: SupportedCurrency.CAD, quantity: "5.0214000000",      averageCost: "796.06285100" },
  { ticker: "XID",  securityName: "iShares India Index ETF",                         securityCurrency: SupportedCurrency.CAD, quantity: "15.0000000000",     averageCost: "52.23333330" },
  { ticker: "DNUT", securityName: "Krispy Kreme Inc Common Stock",                   securityCurrency: SupportedCurrency.CAD, quantity: "40.0000000000",     averageCost: "3.49675000" },
  { ticker: "MA",   securityName: "Mastercard Incorporated",                         securityCurrency: SupportedCurrency.CAD, quantity: "1.1465000000",      averageCost: "697.59267340" },
  { ticker: "NVDA", securityName: "Nvidia Corp",                                     securityCurrency: SupportedCurrency.CAD, quantity: "5.0000000000",      averageCost: "120.49800000" },
  { ticker: "NFLX", securityName: "Netflix Inc Com",                                 securityCurrency: SupportedCurrency.CAD, quantity: "15.0000000000",     averageCost: "113.82600000" },
  { ticker: "PPL",  securityName: "Pembina Pipeline Corp",                           securityCurrency: SupportedCurrency.CAD, quantity: "14.0000000000",     averageCost: "44.56357143" },
  { ticker: "PG",   securityName: "Procter & Gamble Co",                             securityCurrency: SupportedCurrency.CAD, quantity: "15.0000000000",     averageCost: "212.85066670" },
  { ticker: "QSR",  securityName: "Restaurant Brands International Inc Com",         securityCurrency: SupportedCurrency.CAD, quantity: "10.0000000000",     averageCost: "73.65900000" },
  { ticker: "RY",   securityName: "Royal Bank of Canada",                            securityCurrency: SupportedCurrency.CAD, quantity: "10.0000000000",     averageCost: "157.89700000" },
  { ticker: "TSLA", securityName: "Tesla Inc Common Stock",                          securityCurrency: SupportedCurrency.CAD, quantity: "6.0000000000",      averageCost: "264.73000000" },
  { ticker: "TRI",  securityName: "Thomson Reuters Corp Com No Par 2026",            securityCurrency: SupportedCurrency.CAD, quantity: "14.0000000000",     averageCost: "147.76500000" },
  { ticker: "T",    securityName: "Telus Corporation",                               securityCurrency: SupportedCurrency.CAD, quantity: "11.0000000000",     averageCost: "27.34000000" },
  { ticker: "VFV",  securityName: "Vanguard S&P 500 Index ETF Tr Unit",              securityCurrency: SupportedCurrency.CAD, quantity: "20.0000000000",     averageCost: "122.11250000" },
];

async function main() {
  const user = await prisma.userProfile.upsert({
    where: {
      email: "dev+phase1@secondact.app"
    },
    update: {
      firstName: "Phase",
      lastName: "One",
      investorHandle: "alpha-maple-01"
    },
    create: {
      id: TEST_USER_ID,
      email: "dev+phase1@secondact.app",
      firstName: "Phase",
      lastName: "One",
      investorHandle: "alpha-maple-01"
    }
  });

  const existingPortfolio = await prisma.portfolio.findFirst({
    where: {
      userId: user.id,
      name: TEST_PORTFOLIO_NAME
    }
  });

  const portfolio =
    existingPortfolio ??
    (await prisma.portfolio.create({
      data: {
        userId: user.id,
        name: TEST_PORTFOLIO_NAME,
        description: "Seed portfolio for backend report pipeline development.",
        baseCurrency: SupportedCurrency.CAD
      }
    }));

  if (existingPortfolio) {
    await prisma.portfolio.update({
      where: {
        id: existingPortfolio.id
      },
      data: {
        description: "Seed portfolio for backend report pipeline development.",
        baseCurrency: SupportedCurrency.CAD
      }
    });
  }

  await prisma.userUsage.upsert({
    where: {
      userId: user.id
    },
    update: {},
    create: {
      userId: user.id
    }
  });

  // Remove any old holdings that are no longer in the seed list
  const seededTickers = HOLDINGS.map((h) => h.ticker);
  await prisma.portfolioHolding.deleteMany({
    where: {
      portfolioId: portfolio.id,
      ticker: { notIn: seededTickers }
    }
  });

  // Upsert all holdings
  for (const h of HOLDINGS) {
    await prisma.portfolioHolding.upsert({
      where: {
        portfolioId_ticker: {
          portfolioId: portfolio.id,
          ticker: h.ticker
        }
      },
      update: {
        securityName: h.securityName,
        securityCurrency: h.securityCurrency,
        quantity: h.quantity,
        averageCost: h.averageCost
      },
      create: {
        userId: user.id,
        portfolioId: portfolio.id,
        ticker: h.ticker,
        securityName: h.securityName,
        securityCurrency: h.securityCurrency,
        quantity: h.quantity,
        averageCost: h.averageCost
      }
    });
  }

  console.info("Seeded Step 2 baseline data.", {
    userId: user.id,
    portfolioId: portfolio.id,
    holdings: seededTickers
  });
}

main()
  .catch((error) => {
    console.error("Failed to seed Step 2 baseline data.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
