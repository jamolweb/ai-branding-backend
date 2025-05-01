-- CreateTable
CREATE TABLE "brandbooks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "tagline" TEXT,
    "industry" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "preferredColor" TEXT,
    "preferredFont" TEXT,
    "logoUrl" TEXT NOT NULL,
    "generatedHtml" TEXT NOT NULL,
    "generatedJson" JSONB,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brandbooks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "brandbooks" ADD CONSTRAINT "brandbooks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
