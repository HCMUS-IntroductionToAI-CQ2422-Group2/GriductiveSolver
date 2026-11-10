"""Hand-authored maps, ordered from 3x3 medium to 5x5 expert."""

from .gallery_3x3 import PUZZLE as GALLERY_3X3
from .harbor_4x4 import PUZZLE as HARBOR_4X4
from .market_3x3 import PUZZLE as MARKET_3X3
from .museum_5x5 import PUZZLE as MUSEUM_5X5
from .observatory_5x5 import PUZZLE as OBSERVATORY_5X5
from .theatre_4x4 import PUZZLE as THEATRE_4X4


PUZZLES = (
    MARKET_3X3,
    GALLERY_3X3,
    HARBOR_4X4,
    THEATRE_4X4,
    MUSEUM_5X5,
    OBSERVATORY_5X5,
)
