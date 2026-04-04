import { IsNumber, IsOptional, IsString, IsArray, IsEnum, Min, Max, MaxLength, IsDateString } from 'class-validator';

const ROUTE_RATING_TAGS = ['safe', 'well_lit', 'heavy_traffic', 'road_works', 'felt_unsafe', 'recommended'] as const;
type RouteRatingTag = (typeof ROUTE_RATING_TAGS)[number];

export class CreateRatingDto {
  @IsOptional()
  @IsString()
  mapboxRouteId?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  originLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  originLng: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  destinationLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  destinationLng: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  overallRating: number;

  @IsOptional()
  @IsArray()
  @IsEnum(ROUTE_RATING_TAGS, { each: true })
  tags?: RouteRatingTag[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  comment?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  travelTimeMinutes?: number;

  @IsOptional()
  @IsDateString()
  departedAt?: string;
}
