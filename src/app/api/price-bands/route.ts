import { NextRequest, NextResponse } from "next/server";
import { enhancedAPIClient } from "@/lib/enhanced-api-client";

interface PriceBandResponse {
  CategoryCode?: string;
  UnitType?: string;
  PriceCode?: string;
  HumanName?: string;
  FilterName?: string;
  ProcessCode?: string;
  CategorySetupMultiplier?: number;
  PriceFormulaType?: string;
  Active?: boolean;
}

export async function POST(request: NextRequest) {
  let body: any = {};

  try {
    body = await request.json();
    const { program, categoryUnitId } = body;

    if (!program) {
      return NextResponse.json(
        { success: false, error: "Program is required" },
        { status: 400 }
      );
    }

    console.log(`🔍 [PRICE-BANDS] Fetching pricing for program: ${program}`);

    // Get the correct category unit ID for this program
    let finalCategoryUnitId = categoryUnitId;
    if (!finalCategoryUnitId) {
      try {
        finalCategoryUnitId = (
          await enhancedAPIClient.getCategoryUnitIdForProgram(program)
        ).toString();
        console.log(
          `🔍 [PRICE-BANDS] Mapped program "${program}" to category unit ID: ${finalCategoryUnitId}`
        );
      } catch (error) {
        console.error(
          `❌ [PRICE-BANDS] Failed to map program "${program}":`,
          error
        );

        // Check if it's a cache initialization error
        if (
          error instanceof Error &&
          error.message.includes("cache initialization failed")
        ) {
          return NextResponse.json(
            {
              success: false,
              error: `Price band service is temporarily unavailable. Please try again in a moment.`,
              details: "Cache initialization in progress",
            },
            { status: 503 } // Service Unavailable
          );
        }

        return NextResponse.json(
          {
            success: false,
            error: `No category unit mapping found for program "${program}". This program may not be configured for pricing.`,
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 400 }
        );
      }
    }

    // Dynamically determine price tier and price code
    let finalPriceTier: string;
    let finalPriceCode: string;

    try {
      finalPriceTier = await enhancedAPIClient.getPriceTierForProgram(program);
      finalPriceCode = await enhancedAPIClient.getPriceCodeForProgram(program);

      console.log(
        `🔍 [PRICE-BANDS] Determined for program "${program}": tier="${finalPriceTier}", code="${finalPriceCode}"`
      );
    } catch (error) {
      console.error(
        `❌ [PRICE-BANDS] Failed to determine pricing parameters for program "${program}"`
      );
      return NextResponse.json(
        {
          success: false,
          error: `Failed to determine pricing parameters for program "${program}"`,
        },
        { status: 400 }
      );
    }

    // Call the OMS API directly
    const priceBandResponse = (await enhancedAPIClient.getPriceQuantityBands(
      finalCategoryUnitId,
      finalPriceTier,
      finalPriceCode
    )) as any;

    // Check if the response indicates an error
    if (priceBandResponse?.isError || !priceBandResponse?.isSuccess) {
      console.error(
        `❌ [PRICE-BANDS] API error for program "${program}":`,
        priceBandResponse?.error?.Message || "Unknown error"
      );
      return NextResponse.json(
        {
          success: false,
          error:
            priceBandResponse?.error?.Message ||
            "Failed to fetch price band data",
          program,
        },
        { status: 400 }
      );
    }

    // Transform the response to match our interface
    const transformedData = {
      categoryCode: priceBandResponse?.CategoryCode,
      unitType: priceBandResponse?.UnitType,
      priceCode: priceBandResponse?.PriceCode,
      humanName: priceBandResponse?.HumanName,
      filterName: priceBandResponse?.FilterName,
      processCode: priceBandResponse?.ProcessCode,
      categorySetupMultiplier: priceBandResponse?.CategorySetupMultiplier,
      priceFormulaType: priceBandResponse?.PriceFormulaType,
      active: priceBandResponse?.Active,
    };

    console.log(
      `✅ [PRICE-BANDS] Successfully fetched pricing data for ${program}`
    );

    return NextResponse.json({
      success: true,
      data: transformedData,
      program,
    });
  } catch (error) {
    console.error(`❌ [PRICE-BANDS] Error:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        program: body?.program,
      },
      { status: 500 }
    );
  }
}
