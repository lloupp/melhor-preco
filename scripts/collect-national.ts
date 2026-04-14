import { PrismaClient } from "@prisma/client";
import { runNationalCollection } from "@/lib/collectors";

const prisma = new PrismaClient();

async function main() {
  const result = await runNationalCollection(prisma);
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
