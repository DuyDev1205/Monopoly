extends Node
## Dữ liệu bàn cờ — chép đúng từ js/data.js (bản web). Đổi bên này thì đổi cả bên kia để chơi online chung được.

const START_MONEY := 2000
const SALARY := 200
const BAIL := 100
const ISLAND := 8
const FESTIVAL := 16
const AIRPORT := 24
const AIRPORT_FEE := 50
const SELL_RATE := 0.5
const BUYOUT_RATE := 2
const SIZE := 32
const FEST_MAX := 5

const GROUPS := {
	"brown": {"name": "Miền Tây", "color": "#8457d6", "house": 50},
	"sky": {"name": "Nam Bộ", "color": "#4fb3e3", "house": 50},
	"pink": {"name": "Biển miền Trung", "color": "#d9539e", "house": 100},
	"orange": {"name": "Tây Nguyên", "color": "#f08a24", "house": 100},
	"red": {"name": "Di sản", "color": "#e03b3b", "house": 150},
	"yellow": {"name": "Đường thiên lý", "color": "#e8b512", "house": 150},
	"green": {"name": "Miền Bắc", "color": "#2f9e5b", "house": 200},
	"navy": {"name": "Đô thị", "color": "#2741a8", "house": 200},
}
const RENT_MULT := [1, 5, 14, 30, 50]
const RESORT_RENT := [0, 50, 100, 200, 400]
const TAX_RATE := 0.1
const TAX_MIN := 50
const PLAYER_COLORS := ["#e5383b", "#2f6fde", "#2a9d5c", "#f2a516"]

const ICONS := {
	"🏁": "start", "🦀": "crab", "🎻": "violin", "🧧": "envelope", "🛶": "canoe", "🏝️": "island", "🍊": "tangerine",
	"🥥": "coconut", "🌴": "palm", "🏖️": "beach", "🐟": "fish", "🌊": "wave", "🏜️": "desert", "🌸": "blossom",
	"☕": "coffee", "🎆": "fireworks", "⛱️": "umbrella", "🏮": "lantern", "🦇": "bat", "🏛️": "classical", "🐉": "dragon",
	"🌾": "rice", "✈️": "airplane", "⛰️": "mountain", "🏔️": "snowmountain", "🛳️": "ship", "🐒": "monkey", "💸": "money",
	"🏙️": "city", "🐢": "turtle", "🛵": "scooter", "🐃": "buffalo", "🚤": "speedboat", "🐓": "rooster", "🛟": "buoy",
	"🌳": "tree", "🏆": "trophy", "🎲": "die", "💥": "boom", "🔥": "fire",
}

var BOARD: Array = []
var GROUP_TILES := {}
var RESORTS: Array = []


static func _r5(x: int) -> int:
	return x if x < 20 else int(round(x / 5.0)) * 5


static func rents(price: int) -> Array:
	var base := maxi(4, int(round(price * 0.1)))
	var out := []
	for m in RENT_MULT:
		out.append(_r5(base * m))
	return out


func _c(name: String, group: String, price: int, icon: String) -> Dictionary:
	return {"type": "city", "name": name, "group": group, "price": price, "rent": rents(price), "icon": icon}


func _r(name: String, icon: String) -> Dictionary:
	return {"type": "resort", "name": name, "price": 200, "icon": icon}


func _chance() -> Dictionary:
	return {"type": "chance", "name": "Cơ Hội", "icon": "🧧"}


func _init() -> void:
	BOARD = [
		{"type": "start", "name": "Xuất Phát", "icon": "🏁"},
		_c("Cà Mau", "brown", 60, "🦀"), _c("Bạc Liêu", "brown", 60, "🎻"), _c("Cần Thơ", "brown", 80, "🛶"),
		_r("Phú Quốc", "🏝️"),
		_c("Vĩnh Long", "sky", 100, "🍊"), _c("Bình Phước", "sky", 100, "🌳"), _c("Vũng Tàu", "sky", 120, "🏖️"),
		{"type": "island", "name": "Đảo Hoang", "icon": "🌴"},
		_c("Phan Thiết", "pink", 140, "🐟"), _c("Nha Trang", "pink", 140, "🌊"), _c("Quy Nhơn", "pink", 160, "⛱️"),
		_chance(),
		_c("Đà Lạt", "orange", 180, "🌸"), _r("Mũi Né", "🏜️"), _c("Buôn Ma Thuột", "orange", 200, "☕"),
		{"type": "festival", "name": "Lễ Hội", "icon": "🎆"},
		_c("Hội An", "red", 220, "🏮"), _r("Côn Đảo", "🐢"), _c("Huế", "red", 240, "🏛️"),
		_chance(),
		_c("Đà Nẵng", "yellow", 260, "🐉"), _c("Vinh", "yellow", 260, "🌾"), _c("Ninh Bình", "yellow", 280, "⛰️"),
		{"type": "airport", "name": "Sân Bay", "icon": "✈️"},
		_r("Cát Bà", "🐒"), _c("Sa Pa", "green", 300, "🏔️"), _c("Hạ Long", "green", 320, "🛳️"),
		_chance(),
		_c("TP. Hồ Chí Minh", "navy", 360, "🏙️"),
		{"type": "tax", "name": "Thuế", "icon": "💸"},
		_c("Hà Nội", "navy", 400, "🐢"),
	]
	for i in BOARD.size():
		var t: Dictionary = BOARD[i]
		if t.type == "city":
			if not GROUP_TILES.has(t.group):
				GROUP_TILES[t.group] = []
			GROUP_TILES[t.group].append(i)
		elif t.type == "resort":
			RESORTS.append(i)


## Tiền: 1500 -> "1,5 tỷ", 200 -> "200tr"
static func fmt(n: int) -> String:
	var sign := "-" if n < 0 else ""
	var a := absi(n)
	if a >= 1000:
		var s := String.num(a / 1000.0, 3)
		return sign + s.replace(".", ",") + " tỷ"
	return sign + str(a) + "tr"


func tile_sub(t: Dictionary) -> String:
	match t.type:
		"city", "resort":
			return fmt(t.price)
		"chance":
			return "Rút thẻ"
		"tax":
			return "10% tài sản"
		"start":
			return "Nhận " + fmt(SALARY)
		"island":
			return "Kẹt 3 lượt"
		"festival":
			return "Thuê ×2 → ×5"
		"airport":
			return "Bay · " + fmt(AIRPORT_FEE)
	return ""


func icon_path(t: Dictionary) -> String:
	var k = ICONS.get(t.get("icon", ""), "")
	return "res://assets/icons/%s.webp" % k if k != "" else ""
