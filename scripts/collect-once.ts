import { PrismaClient } from "@prisma/client";
import { runRealCollection } from "../src/lib/collectors/simple-market";

const prisma = new PrismaClient();

async function main() {
  const result = await runRealCollection(prisma);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
