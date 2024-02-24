const TileColors = {
    Empty: "255 255 255 255",
    Wall: "34 34 34 255",
    Floor: "72 59 58 255"
}

const Tiles = {
    Empty: 0,
    Wall: 1,
    Floor: 2,
    Border: 3
}

dataToTiles = function(rawData, mapHeight, mapWidth) {
    const tileMap = []
    for (let i = 0; i < mapArea*4; i += mapHeight*4) {
        if (i == 0 || i >= (mapArea-mapHeight)*4) {
            tileMap.push(new Array(mapWidth).fill(Tiles.Border))
        } else {
            let temp = []
            for (let j = 0; j < mapHeight*4; j += 4) {

                let tileColor = rawData[i+j].toString() + ' ' +
                                rawData[i+j+1].toString() + ' ' +
                                rawData[i+j+2].toString() + ' ' +
                                rawData[i+j+3].toString()

                if (j == 0) {
                    temp.push(Tiles.Border)
                } else if (tileColor == TileColors.Wall) {
                    temp.push(Tiles.Wall)
                } else {
                    switch (tileColor) {
                        case TileColors.Floor:
                            temp.push(Tiles.Floor)
                            break;
                        default:
                            temp.push(Tiles.Empty)
                            break;
                    }
                }
            }
            temp[temp.length - 1] = Tiles.Border
            tileMap.push(temp)
        }
    }
    return tileMap
}


createNewImage = function(imageUrl) {
    let image = new Image()
    image.src = imageUrl
    return image
}


newTile = function(tile, upTile, downTile, leftTile, rightTile, position) {
    switch (tile) {
        case Tiles.Wall:
            return newWall(upTile, downTile, leftTile, rightTile, position)
        case Tiles.Floor:
            return newFloor(position)
        default:
            console.log("Invalid Tile", tile)
            return null
    }
}


const wallTLeftImage = createNewImage('./img/tileset/wallTiles/t-shapes/wallTLeft.png')
const wallTRightImage = createNewImage('./img/tileset/wallTiles/t-shapes/wallTRight.png')
const wallCornerUpLeftImage = createNewImage('./img/tileset/wallTiles/corners/wallCornerUpLeft.png')
const wallCornerUpRightImage = createNewImage('./img/tileset/wallTiles/corners/wallCornerUpRight.png')
const wallCornerDownLeftImage = createNewImage('./img/tileset/wallTiles/corners/wallCornerDownLeft.png')
const wallCornerDownRightImage = createNewImage('./img/tileset/wallTiles/corners/wallCornerDownRight.png')
const wallSideTopLImage = createNewImage('./img/tileset/wallTiles/sides/wallSideTopL.png')
const wallSideTopRImage = createNewImage('./img/tileset/wallTiles/sides/wallSideTopR.png')
const wallFrontFullMidImage = createNewImage('./img/tileset/wallTiles/fronts/wallFrontFullMid.png')

newWall = function(upTile, downTile, leftTile, rightTile, position) {
    let image = new Image()
    let imagePosition = position
    if (upTile == Tiles.Wall && downTile == Tiles.Wall && leftTile == Tiles.Wall) {
        image = wallTLeftImage
        imagePosition.y -= 16
    } else if (upTile == Tiles.Wall && downTile == Tiles.Wall && rightTile == Tiles.Wall) {
        image = wallTRightImage
        imagePosition.y -= 16
    } else if (upTile == Tiles.Wall && leftTile == Tiles.Wall) {
        image = wallCornerUpLeftImage
        imagePosition.x -= (rightTile != Tiles.Floor) ? 11 : 0
        imagePosition.y -= 16
    } else if (upTile == Tiles.Wall && rightTile == Tiles.Wall) {
        image = wallCornerUpRightImage
        imagePosition.x += (leftTile != Tiles.Floor) ? 11 : 0
        imagePosition.y -= 16
    } else if (downTile == Tiles.Wall && leftTile == Tiles.Wall) {
        image = wallCornerDownLeftImage
        imagePosition.x -= (rightTile != Tiles.Floor) ? 11 : 0
        imagePosition.y -= 4
    } else if (downTile == Tiles.Wall && rightTile == Tiles.Wall) {
        image = wallCornerDownRightImage
        imagePosition.x += (leftTile != Tiles.Floor) ? 11 : 0
        imagePosition.y -= 4
    } else if (upTile == Tiles.Wall && downTile == Tiles.Wall && rightTile == Tiles.Floor) {
        image = wallSideTopLImage
    } else if (upTile == Tiles.Wall && downTile == Tiles.Wall && leftTile == Tiles.Floor) {
        image = wallSideTopRImage
    } else if (leftTile == Tiles.Wall && rightTile == Tiles.Wall) {
        imagePosition.y -= 16
        image = wallFrontFullMidImage
    } else {
        imagePosition.y -= 16
        image = wallFrontFullMidImage
    }
    return new Sprite({
        position: imagePosition,
        image: image
      })
}


const floorTile1Image = createNewImage('./img/tileset/floorTiles/floorTile1.png')
const floorTile2Image = createNewImage('./img/tileset/floorTiles/floorTile2.png')
const floorTile3Image = createNewImage('./img/tileset/floorTiles/floorTile3.png')
const floorTile4Image = createNewImage('./img/tileset/floorTiles/floorTile4.png')
const floorTile5Image = createNewImage('./img/tileset/floorTiles/floorTile5.png')
const floorTile6Image = createNewImage('./img/tileset/floorTiles/floorTile6.png')
const floorTile7Image = createNewImage('./img/tileset/floorTiles/floorTile7.png')
const floorTile8Image = createNewImage('./img/tileset/floorTiles/floorTile8.png')
const floorTileLadderImage = createNewImage('./img/tileset/floorTiles/floorTileLadder.png')

newFloor = function(position) {
    n = Math.floor(Math.random() * 3) + 1;
    let image = new Image()
    switch (n) {
        case 1: image = floorTile1Image; break;
        case 2: image = floorTile2Image; break;
        case 3: image = floorTile3Image; break;
        // case 4: image = floorTile4Image; break;
        // case 5: image = floorTile5Image; break;
        // case 6: image = floorTile6Image; break;
        // case 7: image = floorTile7Image; break;
        // case 8: image = floorTile8Image; break;
        default:
            break;
    }
    return new Sprite({
        position: position,
        image: image
      })
}