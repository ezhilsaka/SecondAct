import { SupportedCurrency } from "@prisma/client";

import { prisma } from "@/db/prisma/client";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_NAME = "Phase 1 Demo Portfolio";

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
        baseCurrency: SupportedCurrency.USD
      }
    }));

  if (existingPortfolio) {
    await prisma.portfolio.update({
      where: {
        id: existingPortfolio.id
      },
      data: {
        description: "Seed portfolio for backend report pipeline development.",
        baseCurrency: SupportedCurrency.USD
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

  await prisma.portfolioHolding.upsert({
    where: {
      portfolioId_ticker: {
        portfolioId: portfolio.id,
        ticker: "AAPL"
      }
    },
    update: {
      securityName: "Apple Inc.",
      securityCurrency: SupportedCurrency.USD,
      quantity: "12.5000000000",
      averageCost: "182.25000000"
    },
    create: {
      userId: user.id,
      portfolioId: portfolio.id,
      ticker: "AAPL",
      securityName: "Apple Inc.",
      securityCurrency: SupportedCurrency.USD,
      quantity: "12.5000000000",
      averageCost: "182.25000000"
    }
  });

  await prisma.portfolioHolding.upsert({
    where: {
      portfolioId_ticker: {
        portfolioId: portfolio.id,
        ticker: "SHOP.TO"
      }
    },
    update: {
      securityName: "Shopify Inc.",
      securityCurrency: SupportedCurrency.CAD,
      quantity: "8.0000000000",
      averageCost: "115.00000000"
    },
    create: {
      userId: user.id,
      portfolioId: portfolio.id,
      ticker: "SHOP.TO",
      securityName: "Shopify Inc.",
      securityCurrency: SupportedCurrency.CAD,
      quantity: "8.0000000000",
      averageCost: "115.00000000"
    }
  });

  console.info("Seeded Step 2 baseline data.", {
    userId: user.id,
    portfolioId: portfolio.id,
    holdings: ["AAPL", "SHOP.TO"]
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
