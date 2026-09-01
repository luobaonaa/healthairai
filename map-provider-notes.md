# Map Provider Notes

HealthAir now uses **MapLibre GL JS** with the OpenFreeMap Liberty style rather than Google Maps. The MapLibre implementation is loaded from its documented CDN release to avoid bundling the large WebGL renderer into the application build. OpenFreeMap documents the Liberty style URL used by the application, `https://tiles.openfreemap.org/styles/liberty`.

Live environmental readings continue to come from Open-Meteo. Its forecast API accepts latitude and longitude and can return current, hourly, and daily weather variables; HealthAir uses it alongside the air-quality endpoint for real location-based readings.

## Source documentation

1. [OpenFreeMap Quick Start Guide](https://openfreemap.org/quick_start/)
2. [MapLibre GL JS documentation](https://www.maplibre.org/maplibre-gl-js/docs/)
3. [Open-Meteo Weather Forecast API](https://open-meteo.com/en/docs)

## Air-quality category references

HealthAir’s visual categories use the six-level AQI scale of Good, Moderate, Unhealthy for Sensitive Groups, Unhealthy, Very Unhealthy, and Hazardous. AirNow documents the AQI ranges of 0–50, 51–100, 101–150, 151–200, 201–300, and 301+ respectively. The U.S. EPA AQS reference table lists PM2.5 24-hour breakpoints of 0.0–9.0, 9.1–35.4, 35.5–55.4, 55.5–125.4, 125.5–225.4, and 225.5+ µg/m³ for the same category progression.

4. [AirNow AQI Basics](https://www.airnow.gov/aqi/aqi-basics)
5. [EPA AQS AQI Breakpoints](https://aqs.epa.gov/aqsweb/documents/codetables/aqi_breakpoints.html)
