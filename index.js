const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

canvas.width = 1024
canvas.height = 576

mapWidth = 64
mapHeight = 64
mapArea = mapWidth*mapHeight

playerX = 0
playerY = 0

let imgData = new ImageData(16, 16);
const image = new Image;
image.src = "./img/sampleRooms.png";
// image.src = "./img/sampleDots.png";

image.onload = () => {
  c.drawImage(image, 0, 0);
  imgData = c.getImageData(0, 0, 16, 16);

  var model = new OverlappingModel(imgData.data, imgData.width, imgData.height, 4, mapWidth, mapHeight, false, false, 8);

  model.generate(Math.random);

  // create a blank ImageData
  finalImgData = c.createImageData(mapWidth, mapHeight);

  // write the RGBA data directly in the ImageData
  model.graphics(finalImgData.data);
  
  const collisionsMap = []
  for (let i = 0; i < mapArea*4; i += mapHeight*4) {
    if (i == 0 || i >= (mapArea-mapHeight)*4) {
      collisionsMap.push(new Array(mapWidth).fill(1))
    } else {
      let temp = []
      for (let j = 0; j < mapHeight*4; j += 4) {
        if (finalImgData.data[i+j] == 255 && j != 0) {
          temp.push(0)
        } else {
          temp.push(1)
        }
      }
      temp[temp.length - 1] = 1
      collisionsMap.push(temp)
    }
  }
  console.log(collisionsMap)


  let speed = 3

  const charactersMap = []
  for (let i = 0; i < charactersMapData.length; i += 70) {
    charactersMap.push(charactersMapData.slice(i, 70 + i))
  }
  console.log(charactersMap)

  const boundaries = []
  const offset = {
    x: -(mapWidth)*24 + canvas.width/2,
    y: -(mapHeight)*24 + canvas.height/2
  }

  collisionsMap.forEach((row, i) => {
    row.forEach((symbol, j) => {
      if (symbol === 1)
        boundaries.push(
          new Boundary({
            position: {
              x: j * Boundary.width + offset.x,
              y: i * Boundary.height + offset.y
            }
          })
        )
    })
  })

  const characters = []
  const villagerImg = new Image()
  villagerImg.src = './img/villager/Idle.png'

  const oldManImg = new Image()
  oldManImg.src = './img/oldMan/Idle.png'

  charactersMap.forEach((row, i) => {
    row.forEach((symbol, j) => {
      // 1026 === villager
      if (symbol === 1026) {
        characters.push(
          new Character({
            position: {
              x: j * Boundary.width + offset.x,
              y: i * Boundary.height + offset.y
            },
            image: villagerImg,
            frames: {
              max: 4,
              hold: 60
            },
            scale: 3,
            animate: true,
            dialogue: ['...', 'Hey mister, have you seen my Doggochu?']
          })
        )
      }
      // 1031 === oldMan
      else if (symbol === 1031) {
        characters.push(
          new Character({
            position: {
              x: j * Boundary.width + offset.x,
              y: i * Boundary.height + offset.y
            },
            image: oldManImg,
            frames: {
              max: 4,
              hold: 60
            },
            scale: 3,
            dialogue: ['My bones hurt.']
          })
        )
      }

      if (symbol !== 0) {
        boundaries.push(
          new Boundary({
            position: {
              x: j * Boundary.width + offset.x,
              y: i * Boundary.height + offset.y
            }
          })
        )
      }
    })
  })

  const playerDownImage = new Image()
  playerDownImage.src = './img/playerDown.png'

  const playerUpImage = new Image()
  playerUpImage.src = './img/playerUp.png'

  const playerLeftImage = new Image()
  playerLeftImage.src = './img/playerLeft.png'

  const playerRightImage = new Image()
  playerRightImage.src = './img/playerRight.png'

  let startingPosition = {
    x: canvas.width / 2 - 192 / 4 / 2,
    y: canvas.height / 2 - 68 / 2
  }

  const player = new Sprite({
    position: startingPosition,
    image: playerDownImage,
    frames: {
      max: 4,
      hold: 5
    },
    sprites: {
      up: playerUpImage,
      left: playerLeftImage,
      right: playerRightImage,
      down: playerDownImage
    }
  })

  const background = new Background({
    position: {
      x: offset.x,
      y: offset.y
    },
    width: mapWidth*48,
    height: mapHeight*48
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
    ...characters
  ]
  const renderables = [
    background,
    ...boundaries,
    ...characters,
    player
  ]

  function movePlayer(image, dx, dy, moving) {
      player.animate = true
      player.image = image

      checkForCharacterCollision({
        characters,
        player,
        characterOffset: { x: dx * speed, y: dy * speed }
      })

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
        console.log(playerX/48, playerY/48)
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
    c.fillRect(mapWidth/2 - playerX/48, mapHeight/2 - playerY/48, 1, 1);

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
    if (player.isInteracting) {
      switch (e.key) {
        case ' ':
          player.interactionAsset.dialogueIndex++

          const { dialogueIndex, dialogue } = player.interactionAsset
          if (dialogueIndex <= dialogue.length - 1) {
            document.querySelector('.character-dialogue-box').innerHTML =
              player.interactionAsset.dialogue[dialogueIndex]
            return
          }

          // finish conversation
          player.isInteracting = false
          player.interactionAsset.dialogueIndex = 0
          document.querySelector('.character-dialogue-box').style.display = 'none'

          break
      }
      return
    }

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
