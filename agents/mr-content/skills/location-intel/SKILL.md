---
name: location-intel
description: Local knowledge for each Port32 marina — waters, species, restaurants, hazards, culture.
metadata: { "openclaw": { "emoji": "📍" } }
---

# Location Intelligence

Local knowledge I build over time for each Port32 marina. This is my cheat sheet for writing good prompts — the more I know about each location, the better my dispatches.

**Rule: Before dispatching to a new location, research it first.** Use Firecrawl to learn the local waters, species, restaurants, and culture. Then update this file.

## How to Research a New Location

```bash
# Search for local boating info
FIRECRAWL_API_KEY=... firecrawl search "[location] boating fishing guide" --limit 10
FIRECRAWL_API_KEY=... firecrawl search "[location] waterfront restaurants boat dock" --limit 10
FIRECRAWL_API_KEY=... firecrawl search "Port32 [location] marina" --limit 5

# Scrape the Port32 location page
FIRECRAWL_API_KEY=... firecrawl scrape https://www.port32marinas.com/p32marinas/[location] --only-main-content
```

Then save key findings below.

---

## Tierra Verde, FL
- **Port32 address**: 200 Madonna Blvd
- **Waters**: Pass-A-Grille Channel, Bunces Pass, Boca Ciega Bay, Gulf of Mexico
- **Key destinations**: Shell Key, Egmont Key, Fort De Soto, Passage Key, Beer Can Island (Pine Key)
- **Fish**: Snook, redfish, sheepshead, spotted seatrout, tarpon (summer), black drum, mangrove snapper, grouper/snapper offshore
- **Dock & dine**: Island Grille & Raw Bar (on-site), Doc Ford's (St Pete Pier), The Getaway, Billy's Stone Crab
- **Hazards**: Shallow flats, Bunces Pass bar at low tide, manatee zones, afternoon thunderstorms (May-Oct)
- **Culture**: Gateway to the Gulf. Serious fishing community. Mix of families and offshore anglers.

## Tampa, FL
- **Port32 address**: 5200 W Tyson Ave
- **Waters**: Old Tampa Bay, Hillsborough Bay, Tampa city waterfront
- **On-site**: Hula Bay Club restaurant, Duke's Retired Surfer's Island Bar, Gulfstream Boat Club, fuel dock with Rec 90
- **Key destinations**: Ballast Point, Davis Islands, Bayshore Blvd waterfront, Courtney Campbell Causeway
- **Dock & dine**: Hula Bay Club (on-site), Rick's on the River, Ulele, Salt Shack, Bahama Breeze
- **Culture**: City boating. After-work sunset runs. Hula Bay is the social hub. More lifestyle/casual than hardcore fishing.

## Jacksonville, FL
- **Port32 address**: TBD — research needed
- **Waters**: St. Johns River, Atlantic offshore, Amelia Island, Nassau Sound
- **Fish**: Red drum, flounder, sheepshead, kingfish offshore, cobia
- **Culture**: River + ocean access. Big military presence. Research needed.

## Lighthouse Point, FL
- **Port32 address**: 2831 Marina Circle
- **Waters**: Hillsboro Inlet, ICW, Atlantic offshore
- **Fish**: Sailfish, mahi, snapper, grouper, tarpon in ICW
- **Culture**: SE Florida sportfishing. Sailfish alley. Research needed.

## Ft Lauderdale, FL
- **Port32 address**: Marina Mile / New River area
- **Waters**: New River, Port Everglades, Atlantic offshore
- **Focus**: Yacht/refit facility, 150-ton travel lift, self-service boatyard
- **Culture**: More yacht/service focused than recreational. Research needed.

## Naples, FL
- **Port32 address**: TBD — research needed
- **Waters**: Naples Bay, Gordon Pass, Gulf offshore, 10,000 Islands
- **Fish**: Snook (legendary), tarpon, redfish, grouper offshore, permit on the flats
- **Destinations**: Keewaydin Island, Marco Island, Everglades backcountry
- **Culture**: Upscale boating community. Great inshore fishing. Research needed.

## Marco Island, FL
- **Port32 address**: TBD — research needed
- **Waters**: 10,000 Islands, Caxambas Pass, Gulf offshore, Everglades
- **Fish**: Snook, redfish, tarpon, goliath grouper, permit
- **Culture**: Everglades gateway. Backcountry and offshore. Research needed.

## Cape Coral, FL
- **Port32 address**: TBD — research needed
- **Waters**: Caloosahatchee River, Charlotte Harbor, Pine Island Sound, Matlacha Pass
- **Fish**: Tarpon (Boca Grande legendary), snook, redfish, trout
- **Culture**: Canal city. River boating. Access to Boca Grande. Research needed.

## Palm Beach Gardens, FL
- **Port32 address**: TBD — research needed
- **Waters**: ICW, Jupiter Inlet, Atlantic offshore, Loxahatchee River
- **Fish**: Sailfish, mahi, wahoo, snapper, grouper, snook in ICW
- **Culture**: SE Florida offshore. Jupiter/Palm Beach fishing scene. Research needed.

## Morehead City, NC
- **Port32 address**: Portside marina, TBD
- **Waters**: Bogue Sound, Cape Lookout, Outer Banks, Atlantic offshore, Neuse River
- **Fish**: Red drum, speckled trout, flounder, king mackerel, cobia, false albacore, bluefin tuna (winter)
- **Regulations**: NC fishing license (different from FL!), NC-specific seasons and limits
- **Culture**: Completely different from Florida. Four seasons. Outer Banks culture. Crystal Coast. Research needed.
