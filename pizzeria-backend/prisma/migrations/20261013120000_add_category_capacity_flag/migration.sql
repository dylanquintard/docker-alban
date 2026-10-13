-- Beverages can be sold without consuming the food-production capacity of a time slot.
ALTER TABLE "Category"
ADD COLUMN "countsTowardCapacity" BOOLEAN NOT NULL DEFAULT true;
