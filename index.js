const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

canvas.width = 1024
canvas.height = 576

mapWidth = 64
mapHeight = 64
mapArea = mapWidth*mapHeight

playerX = 0
playerY = 0

let imgData = new ImageData(32, 32);
const image = new Image;
image.src = "./img/sampleRooms.png";
// image.src = "./img/sampleDots.png";

image.onload = () => {
  c.drawImage(image, 0, 0);
  imgData = c.getImageData(0, 0, 32, 32);

  var model = new OverlappingModel(imgData.data, imgData.width, imgData.height, 5, mapWidth, mapHeight, true, false, 8);

  model.generate(Math.random);

  // create a blank ImageData
  finalImgData = c.createImageData(mapWidth, mapHeight);

  // write the RGBA data directly in the ImageData
  model.graphics(finalImgData.data);

  let tileMap = dataToTiles(finalImgData.data, mapHeight, mapWidth)
  console.log(tileMap)

  let speed = 3

  const offset = {
    x: -(mapWidth)*8 + canvas.width/2,
    y: -(mapHeight)*8 + canvas.height/2
  }

  const tiles = []
  const boundaries = []
  tileMap.forEach((row, i) => {
    row.forEach((tile, j) => {

      if (tile == Tiles.Wall || tile == Tiles.Border) {
        boundaries.push(
          new Boundary({
            position: {
              x: j * Boundary.width + offset.x,
              y: i * Boundary.height + offset.y
            }
          })
        )
      }

      if (tile != Tiles.Empty && tile != Tiles.Border) {
        let leftTile = j > 0 ? tileMap[i][j-1] : Tiles.Empty
        let rightTile = j < mapWidth - 1 ? tileMap[i][j+1] : Tiles.Empty
        let upTile = i > 0 ? tileMap[i-1][j] : Tiles.Empty
        let downTile = i < mapHeight - 1 ? tileMap[i+1][j] : Tiles.Empty
        let position = {
          x: j*16 + offset.x,
          y: i*16 + offset.y
        }
        tiles.push(newTile(tile, upTile, downTile, leftTile, rightTile, position))
      }

    })
  })

  const elfIdle1Image = new Image()
  elfIdle1Image.src = './img/tileset/characters/elf/elfIdle1.png'

  const elfIdle2Image = new Image()
  elfIdle2Image.src = './img/tileset/characters/elf/elfIdle2.png'

  const elfIdle3Image = new Image()
  elfIdle3Image.src = './img/tileset/characters/elf/elfIdle3.png'

  const elfIdle4Image = new Image()
  elfIdle4Image.src = './img/tileset/characters/elf/elfIdle4.png'

  let startingPosition = {
    x: canvas.width / 2 - 8,
    y: canvas.height / 2 - 12
  }

  const player = new Sprite({
    position: startingPosition,
    image: elfIdle4Image,
    frames: {
      max: 1,
      hold: 5
    },
    sprites: {
      up: elfIdle1Image,
      left: elfIdle2Image,
      right: elfIdle3Image,
      down: elfIdle4Image
    }
  })

  const background = new Background({
    position: {
      x: offset.x,
      y: offset.y
    },
    width: mapWidth*16,
    height: mapHeight*16
  })

  const keys = {
    w: {
      pressed: false
    },
    a: {
      pressed: false
    },
    s: {
      pressed: false
    },
    d: {
      pressed: false
    }
  }

  const movables = [
    background,
    ...boundaries,
    ...tiles
  ]
  const renderables = [
    background,
    ...boundaries,
    ...tiles,
    player
  ]

  function movePlayer(image, dx, dy, moving) {
      player.animate = true
      player.image = image  

      for (let i = 0; i < boundaries.length; i++) {
        const boundary = boundaries[i]
        if (
          rectangularCollision({
            rectangle1: player,
            rectangle2: {
              ...boundary,
              position: {
                x: boundary.position.x + dx * speed,
                y: boundary.position.y + dy * speed
              }
            }
          })
        ) {
          moving = false
          break
        }
      }

      if (moving) {
        movables.forEach((movable) => {
          movable.position.x += dx * speed
          movable.position.y += dy * speed
        })
        playerX += dx * speed
        playerY += dy * speed
        console.log(playerX/16, playerY/16)
      }
      
      return moving
  }

  function animate() {
    const animationId = window.requestAnimationFrame(animate)
    renderables.forEach((renderable) => {
      renderable.draw()
    })
    // print the ImageData in the canvas
    c.putImageData(finalImgData, 0, 0);
    c.fillStyle = "#00FF00"
    c.fillRect(mapWidth/2 - playerX/16, mapHeight/2 - playerY/16, 1, 1);

    let moving = true
    player.animate = false

    // WASD keys control movement
    // If multiple keys are pressed, move in direction of last key pressed
    if (keys.w.pressed && (lastKey === 'w' || (!keys.a.pressed && !keys.s.pressed && !keys.d.pressed))) {
      moving = movePlayer(player.sprites.up, 0, speed, moving)
    } else if (keys.a.pressed && (lastKey === 'a' || (!keys.w.pressed && !keys.s.pressed && !keys.d.pressed))) {
      moving = movePlayer(player.sprites.left, speed, 0, moving)
    } else if (keys.s.pressed && (lastKey === 's' || (!keys.w.pressed && !keys.a.pressed && !keys.d.pressed))) {
      moving = movePlayer(player.sprites.down, 0, -speed, moving)
    } else if (keys.d.pressed && (lastKey === 'd' || (!keys.w.pressed && !keys.a.pressed && !keys.s.pressed))) {
      moving = movePlayer(player.sprites.right, -speed, 0, moving)
    }
  }

  animate()

  let lastKey = ''
  window.addEventListener('keydown', (e) => {

    switch (e.key) {
      case ' ':
        if (!player.interactionAsset) return

        // beginning the conversation
        const firstMessage = player.interactionAsset.dialogue[0]
        document.querySelector('.character-dialogue-box').innerHTML = firstMessage
        document.querySelector('.character-dialogue-box').style.display = 'flex'
        player.isInteracting = true
        break

      case 'w':
        keys.w.pressed = true
        lastKey = 'w'
        break

      case 'a':
        keys.a.pressed = true
        lastKey = 'a'
        break

      case 's':
        keys.s.pressed = true
        lastKey = 's'
        break

      case 'd':
        keys.d.pressed = true
        lastKey = 'd'
        break
    }
  })

  window.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'w':
        keys.w.pressed = false
        break
      case 'a':
        keys.a.pressed = false
        break
      case 's':
        keys.s.pressed = false
        break
      case 'd':
        keys.d.pressed = false
        break
    }
  })
}
