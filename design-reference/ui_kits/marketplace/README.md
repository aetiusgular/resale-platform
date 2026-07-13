# Marketplace UI kit — Browse

One demonstration screen ("The archive" browse view) composing the nine chartered
components: header with wordmark/nav/TierBadge/Button, the screen's single serif
moment, TabBar categories (active tab = the view's accent), Tag designer filters,
Dropdown sort, a 4→3→2→1 responsive ListingCard grid at 24px gutters, and a
Make-an-offer Modal (mono Input) that confirms with a Toast.

No product mock existed to recreate — this screen exists to demonstrate layout
rules (1280 max width, ≥64px sections) and component composition. Listing
photographs were not supplied; cards render their honest mono "3 : 4" placeholder
frames. Drop real 3:4 photography into `imageSrc` when it exists.

Interactions: category tabs and designer tags filter the grid; sort reorders;
clicking a record opens the offer modal; sending confirms with a toast.
