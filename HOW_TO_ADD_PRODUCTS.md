# How to Add Products - Simple Guide

This guide explains how to add products to your store using the **simple step-by-step wizard**.

## Adding a Product (Step-by-Step)

When you click **"Add Product"**, you'll see a 5-step wizard that asks simple questions. Just answer them and you're done!

---

### Step 1: Basic Information
**What it asks:** Product name and description

**Example:**
- Product Name: `Casual Pants`
- Description: `Comfortable cotton pants for everyday wear`

---

### Step 2: Product Options
**Question:** Does this product have different options?

**Choose:**
- **NO** - For simple products (one option only)
  - Example: Gold Watch (just one version)
- **YES** - For products with colors, sizes, etc.
  - Example: Pants (comes in different colors and sizes)

---

### Step 3: Define Options (Only if you chose YES in Step 2)
**What it asks:** What options does your product have?

#### Example 1: Pants (Color + Size)
- **First Option:** Color
- **Values:** `red, green, blue`
- **Add Second Option?** ✓ Yes
- **Second Option:** Size
- **Values:** `S, L, XL`
- **Result:** 9 variants created automatically (3 colors × 3 sizes)

#### Example 2: Shoes (Color + Size)
- **First Option:** Color
- **Values:** `gold, black`
- **Add Second Option?** ✓ Yes
- **Second Option:** Size
- **Values:** `36, 37, 38, 39`
- **Result:** 8 variants created (2 colors × 4 sizes)

#### Example 3: MacBook (Color + Capacity)
- **First Option:** Color
- **Values:** `blue, red, silver`
- **Add Second Option?** ✓ Yes
- **Second Option:** Capacity
- **Values:** `256GB, 1TB, 2TB`
- **Result:** 9 variants created (3 colors × 3 capacities)

---

### Step 4: Pricing
**Question:** Is the price the same for all options?

**Choose:**
- **YES, same price** - All options cost the same
  - Example: Pants - all colors/sizes are $50
  - You'll enter one price: `50`

- **NO, different prices** - Each option has its own price
  - Example: MacBook - bigger storage costs more
  - You'll see a list where you can set the price for each:
    - Blue 256GB → $250
    - Blue 1TB → $350
    - Blue 2TB → $450
    - Red 256GB → $270
    - ... and so on

---

### Step 5: Images
**Question:** Do different options need different photos?

**Choose:**
- **NO** - Use one photo for everything
  - Good for: Products that look the same regardless of size

- **YES** - Different photo for each option
  - Example: Show blue pants when customer selects blue, black pants when they select black
  - You'll see a grid where you can upload a photo for each color

---

## Real Examples

### Example 1: Simple Watch
```
Step 1: Name = "Gold Watch"
Step 2: Has options? NO
Step 4: Price = 20
Step 5: Upload one photo → DONE!
```

### Example 2: Pants (Same Price)
```
Step 1: Name = "Casual Pants"
Step 2: Has options? YES
Step 3:
  - Color: red, green, blue
  - Size: S, L, XL
Step 4: Same price? YES → Price = 50
Step 5: Different photos? YES
  - Upload red pant photo for all red variants
  - Upload green pant photo for all green variants
  - Upload blue pant photo for all blue variants
DONE! 9 variants created
```

### Example 3: MacBook (Different Prices)
```
Step 1: Name = "MacBook 13"
Step 2: Has options? YES
Step 3:
  - Color: blue, red, silver
  - Capacity: 256GB, 1TB, 2TB
Step 4: Same price? NO
  - Set individual prices:
    Blue 256GB = 250
    Blue 1TB = 350
    Blue 2TB = 450
    Red 256GB = 270
    (etc...)
Step 5: Different photos? YES
  - Upload photo for each color
DONE! 9 variants created with different prices
```

---

## How Customers See It

When a customer views a product with options, they see:

```
[Product Image]

PRODUCT NAME
Description text...

SELECT COLOR:
[Red] [Green] [Blue]  ← Big, obvious buttons

SELECT SIZE:
[S] [L] [XL]  ← Big, obvious buttons

✓ Your Selection: color: Red, size: L

$50.00
[Add to Cart]
```

- Selected options are **bright blue** with a shadow
- Non-selected options are white with a gray border
- Clear confirmation box shows exactly what they picked
- When they click a color, the product image changes (if you uploaded different images)

---

## Tips

1. **Separating values:** Use commas between options
   - ✅ Correct: `red, blue, green`
   - ❌ Wrong: `red blue green`

2. **Variant images:** Only upload images for the PRIMARY option (usually color)
   - If product has Color + Size, upload one image per color
   - The wizard shows you exactly which variants need images

3. **SKU codes:** Generated automatically, you can edit them later if needed

4. **Stock:** Optional - you can set stock quantities in the last step

---

## What Changed?

**Before:** You had to manually create each variant one by one
- Pant Red/S, Pant Red/L, Pant Red/XL
- Pant Blue/S, Pant Blue/L, Pant Blue/XL
- ... 9 separate entries!

**Now:** Just answer simple questions
- What colors? red, blue, green
- What sizes? S, L, XL
- Click "Generate" → 9 variants created instantly!

Much faster and way less confusing!
