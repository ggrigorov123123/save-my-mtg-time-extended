import pw from "playwright";
import intersectionBy from "lodash.intersectionby";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CardItem = {
  name: string;
  count: string;
  id: string;
  urlId: string;
  cardUrl: string;
};

type CardResp = { userId: string; cards: CardItem[] };

const getLastPage = (page: pw.Page) => {
  return page.$eval(".controls a:last-child", async (linkEl) => {
    const href = (await linkEl?.getAttribute("href")) ?? "";
    const matched = href.match(/p=(\d+)/) ?? ["", 0];
    return Number(matched[1]);
  });
};

const getCards = (page: pw.Page) => {
  return page.$$eval("#set_cards_table_details tr[id]", (listedCards) => {
    const cardsList: CardItem[] = [];
    listedCards.forEach((listedCard) => {
      const cardData: CardItem = {
        name: "",
        count: "",
        id: "",
        urlId: "",
        cardUrl: "",
      };
      cardData.id = listedCard.getAttribute("id") ?? "";
      cardData.name =
        (listedCard.querySelector("td:nth-child(2)") as any)?.innerText ??
        "FAILED TO GET";
      cardData.count =
        (listedCard.querySelector(".tradelist_count") as any)?.innerText ?? 1;
      cardData.cardUrl =
        (listedCard.querySelector("td > a") as any)?.getAttribute("href") ?? "";

      const idMatch = cardData.cardUrl.match(/printing=(\d+)/) ?? ["", ""];
      cardData.urlId = idMatch[1];

      cardsList.push(cardData);
    });

    return cardsList;
  });
};

function isOutdated(cacheDate: Date, targetDate: Date) {
  return false;
  // For now let's not scrape again
  // const thirtyMinutesInMilliseconds = 30 * 60 * 1000; // 30min
  // const timeDifference = targetDate.getTime() - new Date(cacheDate).getTime();

  // return timeDifference >= thirtyMinutesInMilliseconds;
}

const scrapeDeckbox = async (id: number) => {
  console.info("Starting to scrape for ", id);
  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const cardsList: CardItem[] = [];

  const p = 1;
  const initUrl = `https://deckbox.org/sets/${id}?p=${p}&v=l`;
  await page.goto(initUrl);
  await page.waitForLoadState("networkidle");

  const lastPage = await getLastPage(page);

  for (let index = p; index < lastPage + 1; index++) {
    const targetUrl = `https://deckbox.org/sets/${id}?p=${index}&v=l`;
    if (initUrl !== targetUrl) {
      await page.goto(targetUrl);
      await page.waitForLoadState("networkidle");
    }

    const list = await getCards(page);
    cardsList.push(...list);
    console.info(
      `Scraped for ID ${id} page ${index}. Current count ${cardsList.length}`
    );
  }

  page.close();
  return cardsList;
};

const scrapeMoxfield = async (id: string) => {
  console.info("Starting to scrape for ", id);
  const browser = await pw.chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const initUrl = `https://www.moxfield.com/decks/${id}`;
  await page.goto(initUrl);
  await page.waitForLoadState("networkidle");

  const cardsList: CardItem[] = await page.$$eval(
    '.deckview a[href^="/cards/"]',
    (listedCards: HTMLElement[]) => {
      const list: CardItem[] = [];
      listedCards.forEach((listedCard) => {
        const cardData: CardItem = {
          name: "",
          count: "",
          id: "",
          urlId: "",
          cardUrl: "",
        };
        cardData.id = listedCard.getAttribute("id") ?? "";
        cardData.name = listedCard.innerText ?? "FAILED TO GET";
        cardData.count = "0";
        cardData.cardUrl =
          "https://www.moxfield.com" + listedCard.getAttribute("href") ?? "";

        cardData.urlId = listedCard.getAttribute("id")?.split("-")[1] ?? "";

        list.push(cardData);
      });

      return list;
    }
  );
  page.close();
  return cardsList;
};

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const deckboxResults: CardResp[] = [];
  const moxfieldResults: CardResp[] = [];

  for (const deckId of body.moxfield) {
    const scrapedData = await prisma.scrapedEntry.findFirst({
      where: { userId: { equals: deckId } },
    });

    if (scrapedData === null || isOutdated(scrapedData.createdAt, new Date())) {
      const cardsList = await scrapeMoxfield(deckId);
      try {
        await prisma.scrapedEntry.create({
          data: {
            userId: deckId,
            cards: JSON.stringify(cardsList),
          },
        });
      } catch (e) {
        console.error("Prisma failed", e);
      }
    }

    moxfieldResults.push({
      userId: deckId,
      cards: scrapedData?.cards ? JSON.parse(scrapedData?.cards) : [],
    });
  }

  for (const userId of body.deckbox) {
    const scrapedData = await prisma.scrapedEntry.findFirst({
      where: { userId: { equals: userId } },
    });
    if (scrapedData === null || isOutdated(scrapedData.createdAt, new Date())) {
      const cardsList = await scrapeDeckbox(userId);
      try {
        await prisma.scrapedEntry.create({
          data: {
            userId: userId,
            cards: JSON.stringify(cardsList),
          },
        });
      } catch (e) {
        console.error("Prisma failed", e);
      }
    }

    deckboxResults.push({
      userId,
      cards: scrapedData?.cards ? JSON.parse(scrapedData?.cards) : [],
    });
  }

  const search = body.cards.map((card: string) => ({
    name: card,
  }));

  const findings: { deckbox: CardResp[]; moxfield: CardResp[] } = {
    deckbox: [],
    moxfield: [],
  };

  deckboxResults.forEach((userEntry) => {
    const finds = intersectionBy(userEntry.cards, search, "name");
    if (finds.length > 0) {
      findings.deckbox.push({ userId: userEntry.userId, cards: finds });
    }
  });

  moxfieldResults.forEach((userEntry) => {
    const finds = intersectionBy(userEntry.cards, search, "name");
    if (finds.length > 0) {
      findings.moxfield.push({ userId: userEntry.userId, cards: finds });
    }
  });

  return findings;
});
