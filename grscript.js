// @ts-check
'use strict'
let arrayOfPoses = [];
let positionOfIFTip = [];
document.getElementById('textbox').value = '';
let framerate = 60;
let space = 0;
const FingerState = {
    Open: 'Open',
    SemiOpen: 'SemiOpen',
    Closed: 'Closed'
}

const DirectHand = {
    Up: 'Up',
    Down: 'Down',
    Left: 'Left',
    Right: 'Right'
}

const $ = {
    /**
     * @type {HTMLPreElement}
     */
    log: document.getElementById('logs'),
    /**
     * @type {HTMLVideoElement}
     */
    input: document.getElementById('input'),
    /**
     * @type {HTMLCanvasElement}
     */
    output: document.getElementById('output')
}

const g = {
    // Это контекст холста, на котором можно рисовать
    ctx: $.output.getContext('2d'),
    // Это инициализированный Mediapipe Hands
    hands: null
}

// Переменная которая блокирует ввод новых значений
let lock = false

log('Запрос доступа к камере...')
navigator.mediaDevices
    .getUserMedia({
        audio: false,
        video: {
            facingMode: 'user',
            width: 1280,
            height: 720
        }
    })
    .then(function (stream) {
        framerate = stream.getVideoTracks()[0].getSettings().frameRate
        log(`Камера - ${framerate} кадров в секунду`)
        log('Инициализация Mediapipe Hands...')
        g.hands = new Hands({
            locateFile(file) {
                log('Загрузка зависимости Mediapipe Hands: ' + file)
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            }
        })


        g.hands.setOptions({
            maxNumHands: 2,
            minDetectionConfidence: 0.7
        })

        g.hands.onResults(function (results) {
            sendAndRender()

            // Если заблочено то игнорируем
            if (lock) {
                return
            }

            g.ctx.drawImage(results.image, 0, 0, $.output.width, $.output.height)

            if (!results.multiHandLandmarks) {
                space++;
                if (space > framerate * 2 / 3) {
                    const textbox = document.getElementById('textbox')

                    if (!textbox.value.endsWith(' ')) {
                        if (textbox.value.trim().length > 0) {
                            textbox.value += ' '
                            lock = true
                            fetch('https://speller.yandex.net/services/spellservice.json/checkText?text=' + encodeURIComponent(textbox.value))
                                .then((response) => response.json())
                                .then((json) => {
                                    /**
                                     * result это:
                                     *   code: 1
                                     *   col: 0
                                     *   len: 5
                                     *   pos: 0
                                     *   row: 0
                                     *   s: (2) ["долг", "долго"]
                                     *   word: "доллг"
                                     */
                                    for (const result of json) {
                                        textbox.value = textbox.value.replace(result.word, result.s[0]).trim()
                                    }
                                })
                                .finally(() => {
                                    lock = false
                                })
                        }
                    }
                    space = 0;
                }
                return
            }
                else { space = 0 }
            

            for (const hand of results.multiHandLandmarks) {
                drawConnectors(g.ctx, hand, HAND_CONNECTIONS, {
                    color: '#ff00ff',
                    lineWidth: 3
                })
            }

            try {
                for (const id in results.multiHandLandmarks) {

                    const hand = results.multiHandLandmarks[id].map(
                        (mark) => new Vector2(mark.x, mark.y)
                    )

                    const [
                        WRIST,
                        THUMB_CMC,
                        THUMB_MCP,
                        THUMB_IP,
                        THUMB_TIP,
                        INDEX_FINGER_MCP,
                        INDEX_FINGER_PIP,
                        INDEX_FINGER_DIP,
                        INDEX_FINGER_TIP,
                        MIDDLE_FINGER_MCP,
                        MIDDLE_FINGER_PIP,
                        MIDDLE_FINGER_DIP,
                        MIDDLE_FINGER_TIP,
                        RING_FINGER_MCP,
                        RING_FINGER_PIP,
                        RING_FINGER_DIP,
                        RING_FINGER_TIP,
                        PINKY_MCP,
                        PINKY_PIP,
                        PINKY_DIP,
                        PINKY_TIP
                    ] = hand

                    let thumbState = FingerState.SemiOpen
                    let indexState = FingerState.SemiOpen
                    let middleState = FingerState.SemiOpen
                    let ringState = FingerState.SemiOpen
                    let pinkyState = FingerState.SemiOpen
                    let toRight = false
                    let distanceForScale = distanceTwoDots(MIDDLE_FINGER_MCP, MIDDLE_FINGER_PIP);
                    distanceForScale = distanceForScale * 5;
                    if ((direction(WRIST, MIDDLE_FINGER_MCP) == 'Up')) {

                        if (isFingersNear(THUMB_TIP, INDEX_FINGER_MCP)) {
                            if (THUMB_IP.y > THUMB_MCP.y && THUMB_TIP.y > THUMB_MCP.y) {
                                thumbState = FingerState.Open
                            }
                        } else {
                            if (less(THUMB_IP.x, THUMB_MCP.x, 0.01 * distanceForScale) && less(THUMB_TIP.x, THUMB_MCP.x, 0.01 * distanceForScale)) {
                                thumbState = FingerState.Open
                            } else if (more(THUMB_IP.x, THUMB_MCP.x, 0.01 * distanceForScale) && more(THUMB_TIP.x, THUMB_MCP.x, 0.01 * distanceForScale)) {
                                thumbState = FingerState.Closed
                            } else {
                                thumbState = FingerState.SemiOpen
                            }
                            if (!orientation(INDEX_FINGER_MCP, PINKY_MCP)) {
                                if (thumbState == FingerState.Closed) { thumbState = FingerState.Open }
                                else if (thumbState == FingerState.Open) { thumbState = FingerState.Closed }
                            }
                        }

                        if (less(INDEX_FINGER_DIP.y, INDEX_FINGER_PIP.y, 0.03 * distanceForScale) && less(INDEX_FINGER_TIP.y, INDEX_FINGER_PIP.y, 0.03 * distanceForScale)) {
                            indexState = FingerState.Open
                        } else if (more(INDEX_FINGER_DIP.y, INDEX_FINGER_PIP.y, 0.03 * distanceForScale) && more(INDEX_FINGER_TIP.y, INDEX_FINGER_PIP.y, 0.03 * distanceForScale)) {
                            indexState = FingerState.Closed
                        } else {
                            indexState = FingerState.SemiOpen
                        }

                        if (less(MIDDLE_FINGER_DIP.y, MIDDLE_FINGER_PIP.y, 0.03 * distanceForScale) && less(MIDDLE_FINGER_TIP.y, MIDDLE_FINGER_PIP.y, 0.03 * distanceForScale)) {
                            middleState = FingerState.Open
                        } else if (more(MIDDLE_FINGER_DIP.y, MIDDLE_FINGER_PIP.y, 0.03 * distanceForScale) && more(MIDDLE_FINGER_TIP.y, MIDDLE_FINGER_PIP.y, 0.03 * distanceForScale)) {
                            middleState = FingerState.Closed
                        } else {
                            middleState = FingerState.SemiOpen
                        }

                        if (less(RING_FINGER_DIP.y, RING_FINGER_PIP.y, 0.03 * distanceForScale) && less(RING_FINGER_TIP.y, RING_FINGER_PIP.y, 0.03 * distanceForScale)) {
                            ringState = FingerState.Open
                        } else if (more(RING_FINGER_DIP.y, RING_FINGER_PIP.y, 0.03 * distanceForScale) && more(RING_FINGER_TIP.y, RING_FINGER_PIP.y, 0.03 * distanceForScale)) {
                            ringState = FingerState.Closed
                        } else {
                            ringState = FingerState.SemiOpen
                        }

                        if (less(PINKY_DIP.y, PINKY_PIP.y, 0.01 * distanceForScale) && less(PINKY_TIP.y, PINKY_PIP.y, 0.01 * distanceForScale)) {
                            pinkyState = FingerState.Open
                        } else if (more(PINKY_DIP.y, PINKY_PIP.y, 0.01 * distanceForScale) && more(PINKY_TIP.y, PINKY_PIP.y, 0.01 * distanceForScale)) {
                            pinkyState = FingerState.Closed
                        } else {
                            pinkyState = FingerState.SemiOpen
                        }
                    }
                    else if ((direction(WRIST, MIDDLE_FINGER_MCP) == 'Down')) {

                        if (isFingersNear(THUMB_TIP, INDEX_FINGER_MCP)) {
                            if (THUMB_IP.y < THUMB_MCP.y && THUMB_TIP.y < THUMB_MCP.y) {
                                thumbState = FingerState.Open
                            }
                        } else {
                            if (less(THUMB_IP.x, THUMB_MCP.x, 0.01 * distanceForScale) && less(THUMB_TIP.x, THUMB_MCP.x, 0.01 * distanceForScale)) {
                                thumbState = FingerState.Open
                            } else if (more(THUMB_IP.x, THUMB_MCP.x, 0.01 * distanceForScale) && more(THUMB_TIP.x, THUMB_MCP.x, 0.01 * distanceForScale)) {
                                thumbState = FingerState.Closed
                            } else {
                                thumbState = FingerState.SemiOpen
                            }
                            if (!orientation(INDEX_FINGER_MCP, PINKY_MCP)) {
                                if (thumbState == FingerState.Closed) { thumbState = FingerState.Open }
                                else if (thumbState == FingerState.Open) { thumbState = FingerState.Closed }
                            }
                        }

                        if (less(INDEX_FINGER_DIP.y, INDEX_FINGER_PIP.y, 0.03 * distanceForScale) && less(INDEX_FINGER_TIP.y, INDEX_FINGER_PIP.y, 0.03 * distanceForScale)) {
                            indexState = FingerState.Closed
                        } else if (more(INDEX_FINGER_DIP.y, INDEX_FINGER_PIP.y, 0.03 * distanceForScale) && more(INDEX_FINGER_TIP.y, INDEX_FINGER_PIP.y, 0.03 * distanceForScale)) {
                            indexState = FingerState.Open
                        } else {
                            indexState = FingerState.SemiOpen
                        }

                        if (less(MIDDLE_FINGER_DIP.y, MIDDLE_FINGER_PIP.y, 0.03 * distanceForScale) && less(MIDDLE_FINGER_TIP.y, MIDDLE_FINGER_PIP.y, 0.03 * distanceForScale)) {
                            middleState = FingerState.Closed
                        } else if (more(MIDDLE_FINGER_DIP.y, MIDDLE_FINGER_PIP.y, 0.03 * distanceForScale) && more(MIDDLE_FINGER_TIP.y, MIDDLE_FINGER_PIP.y, 0.03 * distanceForScale)) {
                            middleState = FingerState.Open
                        } else {
                            middleState = FingerState.SemiOpen
                        }

                        if (less(RING_FINGER_DIP.y, RING_FINGER_PIP.y, 0.03 * distanceForScale) && less(RING_FINGER_TIP.y, RING_FINGER_PIP.y, 0.03 * distanceForScale)) {
                            ringState = FingerState.Closed
                        } else if (more(RING_FINGER_DIP.y, RING_FINGER_PIP.y, 0.03 * distanceForScale) && more(RING_FINGER_TIP.y, RING_FINGER_PIP.y, 0.03 * distanceForScale)) {
                            ringState = FingerState.Open
                        } else {
                            ringState = FingerState.SemiOpen
                        }

                        if (less(PINKY_DIP.y, PINKY_PIP.y, 0.01 * distanceForScale) && less(PINKY_TIP.y, PINKY_PIP.y, 0.01 * distanceForScale)) {
                            pinkyState = FingerState.Closed
                        } else if (more(PINKY_DIP.y, PINKY_PIP.y, 0.01 * distanceForScale) && more(PINKY_TIP.y, PINKY_PIP.y, 0.01 * distanceForScale)) {
                            pinkyState = FingerState.Open
                        } else {
                            pinkyState = FingerState.SemiOpen
                        }
                    }
                    else if ((direction(WRIST, MIDDLE_FINGER_MCP) == 'Left')) {

                        if (isFingersNear(THUMB_TIP, INDEX_FINGER_MCP)) {
                            {
                                thumbState = FingerState.Open
                            }
                        } else {
                            if (less(THUMB_IP.y, THUMB_MCP.y, 0.01 * distanceForScale) && less(THUMB_TIP.y, THUMB_MCP.y, 0.01 * distanceForScale)) {
                                thumbState = FingerState.Closed
                            } else if (more(THUMB_IP.y, THUMB_MCP.y, 0.01 * distanceForScale) && more(THUMB_TIP.y, THUMB_MCP.y, 0.01 * distanceForScale)) {
                                thumbState = FingerState.Open
                            } else {
                                thumbState = FingerState.SemiOpen
                            }
                            if (direction(INDEX_FINGER_MCP, PINKY_MCP) == 'Down') {
                                if (thumbState == FingerState.Closed) { thumbState = FingerState.Open }
                                else if (thumbState == FingerState.Open) { thumbState = FingerState.Closed }
                            }
                        }

                        if (less(INDEX_FINGER_DIP.x, INDEX_FINGER_PIP.x, 0.03 * distanceForScale) && less(INDEX_FINGER_TIP.x, INDEX_FINGER_PIP.x, 0.03 * distanceForScale)) {
                            indexState = FingerState.Open
                        } else if (more(INDEX_FINGER_DIP.x, INDEX_FINGER_PIP.x, 0.03 * distanceForScale) && more(INDEX_FINGER_TIP.x, INDEX_FINGER_PIP.x, 0.03 * distanceForScale)) {
                            indexState = FingerState.Closed
                        } else {
                            indexState = FingerState.SemiOpen
                        }

                        if (less(MIDDLE_FINGER_DIP.x, MIDDLE_FINGER_PIP.x, 0.03 * distanceForScale) && less(MIDDLE_FINGER_TIP.x, MIDDLE_FINGER_PIP.x, 0.03 * distanceForScale)) {
                            middleState = FingerState.Open
                        } else if (more(MIDDLE_FINGER_DIP.x, MIDDLE_FINGER_PIP.x, 0.03 * distanceForScale) && more(MIDDLE_FINGER_TIP.x, MIDDLE_FINGER_PIP.x, 0.03 * distanceForScale)) {
                            middleState = FingerState.Closed
                        } else {
                            middleState = FingerState.SemiOpen
                        }

                        if (less(RING_FINGER_DIP.x, RING_FINGER_PIP.x, 0.03 * distanceForScale) && less(RING_FINGER_TIP.x, RING_FINGER_PIP.x, 0.03 * distanceForScale)) {
                            ringState = FingerState.Open
                        } else if (more(RING_FINGER_DIP.x, RING_FINGER_PIP.x, 0.03 * distanceForScale) && more(RING_FINGER_TIP.x, RING_FINGER_PIP.x, 0.03 * distanceForScale)) {
                            ringState = FingerState.Closed
                        } else {
                            ringState = FingerState.SemiOpen
                        }

                        if (less(PINKY_DIP.x, PINKY_PIP.x, 0.01 * distanceForScale) && less(PINKY_TIP.x, PINKY_PIP.x, 0.01 * distanceForScale)) {
                            pinkyState = FingerState.Open
                        } else if (more(PINKY_DIP.x, PINKY_PIP.x, 0.01 * distanceForScale) && more(PINKY_TIP.x, PINKY_PIP.x, 0.01 * distanceForScale)) {
                            pinkyState = FingerState.Closed
                        } else {
                            pinkyState = FingerState.SemiOpen
                        }
                    }
                    else if ((direction(WRIST, MIDDLE_FINGER_MCP) == 'Right')) {

                        if (isFingersNear(THUMB_TIP, INDEX_FINGER_MCP)) {
                            {
                                thumbState = FingerState.Open
                            }
                        } else {
                            if (less(THUMB_IP.y, THUMB_MCP.y, 0.01 * distanceForScale) && less(THUMB_TIP.y, THUMB_MCP.y, 0.01 * distanceForScale)) {
                                thumbState = FingerState.Closed
                            } else if (more(THUMB_IP.y, THUMB_MCP.y, 0.01 * distanceForScale) && more(THUMB_TIP.y, THUMB_MCP.y, 0.01 * distanceForScale)) {
                                thumbState = FingerState.Open
                            } else {
                                thumbState = FingerState.SemiOpen
                            }
                            if (direction(INDEX_FINGER_MCP, PINKY_MCP) == 'Down') {
                                if (thumbState == FingerState.Closed) { thumbState = FingerState.Open }
                                else if (thumbState == FingerState.Open) { thumbState = FingerState.Closed }
                            }
                        }

                        if (less(INDEX_FINGER_DIP.x, INDEX_FINGER_PIP.x, 0.03 * distanceForScale) && less(INDEX_FINGER_TIP.x, INDEX_FINGER_PIP.x, 0.03 * distanceForScale)) {
                            indexState = FingerState.Closed
                        } else if (more(INDEX_FINGER_DIP.x, INDEX_FINGER_PIP.x, 0.03 * distanceForScale) && more(INDEX_FINGER_TIP.x, INDEX_FINGER_PIP.x, 0.03 * distanceForScale)) {
                            indexState = FingerState.Open
                        } else {
                            indexState = FingerState.SemiOpen
                        }

                        if (less(MIDDLE_FINGER_DIP.x, MIDDLE_FINGER_PIP.x, 0.03 * distanceForScale) && less(MIDDLE_FINGER_TIP.x, MIDDLE_FINGER_PIP.x, 0.03 * distanceForScale)) {
                            middleState = FingerState.Closed
                        } else if (more(MIDDLE_FINGER_DIP.x, MIDDLE_FINGER_PIP.x, 0.03 * distanceForScale) && more(MIDDLE_FINGER_TIP.x, MIDDLE_FINGER_PIP.x, 0.03 * distanceForScale)) {
                            middleState = FingerState.Open
                        } else {
                            middleState = FingerState.SemiOpen
                        }

                        if (less(RING_FINGER_DIP.x, RING_FINGER_PIP.x, 0.03 * distanceForScale) && less(RING_FINGER_TIP.x, RING_FINGER_PIP.x, 0.03 * distanceForScale)) {
                            ringState = FingerState.Closed
                        } else if (more(RING_FINGER_DIP.x, RING_FINGER_PIP.x, 0.03 * distanceForScale) && more(RING_FINGER_TIP.x, RING_FINGER_PIP.x, 0.03 * distanceForScale)) {
                            ringState = FingerState.Open
                        } else {
                            ringState = FingerState.SemiOpen
                        }

                        if (less(PINKY_DIP.x, PINKY_PIP.x, 0.01 * distanceForScale) && less(PINKY_TIP.x, PINKY_PIP.x, 0.01 * distanceForScale)) {
                            pinkyState = FingerState.Closed
                        } else if (more(PINKY_DIP.x, PINKY_PIP.x, 0.01 * distanceForScale) && more(PINKY_TIP.x, PINKY_PIP.x, 0.01 * distanceForScale)) {
                            pinkyState = FingerState.Open
                        } else {
                            pinkyState = FingerState.SemiOpen
                        }
                    }


                    let POSE = 'NULL';
                    //а
                    if (indexState == FingerState.Closed && middleState == FingerState.Closed && ringState == FingerState.Closed && pinkyState == FingerState.Closed && isFingersNear(MIDDLE_FINGER_TIP, WRIST, 0.3)) { POSE = 'А' }
                    //б
                    if (thumbState == FingerState.Closed && indexState == FingerState.Open && middleState == FingerState.SemiOpen && ringState == FingerState.Closed && pinkyState == FingerState.Closed) { POSE = 'Б' }
                    //в
                    if (thumbState == FingerState.Open && indexState == FingerState.Open && middleState == FingerState.Open && ringState == FingerState.Open && pinkyState == FingerState.Open) { POSE = 'В' }
                    //е+ж+с
                    if (thumbState == FingerState.Open && middleState == FingerState.SemiOpen && ringState == FingerState.SemiOpen && pinkyState == FingerState.SemiOpen) {
                        if (isFingersNear(THUMB_TIP, INDEX_FINGER_TIP, 0.1 * distanceForScale)) {
                            if (angle(WRIST, MIDDLE_FINGER_MCP, MIDDLE_FINGER_PIP) > 120) { POSE = 'Е' }
                            else { POSE = 'Ж' }
                        }
                        else { POSE = 'C' }
                    }
                    //б
                    if (thumbState == FingerState.Closed && indexState == FingerState.Open && middleState == FingerState.Closed && ringState == FingerState.Closed && pinkyState == FingerState.Closed) { POSE = 'З' }
                    //и
                    if (!(thumbState == FingerState.Open) && indexState == FingerState.Closed && middleState == FingerState.Closed && ringState == FingerState.Open && pinkyState == FingerState.Open) { POSE = 'И' }
                    //л
                    if (!(thumbState == FingerState.Open) && indexState == FingerState.Open && middleState == FingerState.Open && !(ringState == FingerState.Open) && !(pinkyState == FingerState.Open) && !isFingersNear(MIDDLE_FINGER_TIP, INDEX_FINGER_TIP, 0.07 * distanceForScale)) {
                        if (direction(WRIST, MIDDLE_FINGER_PIP) == 'Down') { POSE = 'Л' }
                        else { POSE = 'К' }
                    }
                    //м
                    if (!(thumbState == FingerState.Open) && indexState == FingerState.Open && middleState == FingerState.Open && (ringState == FingerState.Open) && !(pinkyState == FingerState.Open)) {
                        if (isFingersNear(MIDDLE_FINGER_TIP, RING_FINGER_TIP, 0.05 * distanceForScale)) {
                            if (direction(WRIST, MIDDLE_FINGER_PIP) == 'Down') { POSE = 'Т' }
                            else { POSE = 'Ш' }
                        }
                        else {
                            if (direction(WRIST, MIDDLE_FINGER_PIP) == 'Down') { POSE = 'М' }
                            else { POSE = '3' }
                        }
                    }
                    //н
                    if (thumbState == FingerState.Closed && indexState == FingerState.Open && middleState == FingerState.Open && ringState == FingerState.Closed && pinkyState == FingerState.Open) { POSE = 'Н' }
                    //о
                    if (isFingersNear(THUMB_TIP, INDEX_FINGER_TIP, 0.1 * distanceForScale) && (middleState == FingerState.Open) && (ringState == FingerState.Open) && (pinkyState == FingerState.Open)) { POSE = 'О' }
                    //д+к+п+ц
                    if (!(thumbState == FingerState.Open) && indexState == FingerState.Open && middleState == FingerState.Open && !(ringState == FingerState.Open) && !(pinkyState == FingerState.Open) && isFingersNear(MIDDLE_FINGER_TIP, INDEX_FINGER_TIP, 0.07 * distanceForScale)) {
                        if (direction(WRIST, MIDDLE_FINGER_PIP) == 'Down') { POSE = 'П' }
                        else { POSE = 'К' }
                    }
                    //р
                    if (!(thumbState == FingerState.Open) && indexState == FingerState.Open && !(middleState == FingerState.Open) && ringState == FingerState.Open && pinkyState == FingerState.Open) { POSE = 'Р' }
                    //у
                    if (thumbState == FingerState.Open && indexState == FingerState.Closed && (middleState == FingerState.Closed) && ringState == FingerState.Closed && pinkyState == FingerState.Open) { POSE = 'У' }
                    //х
                    if ((thumbState == FingerState.Closed) && indexState == FingerState.SemiOpen && (middleState == FingerState.Closed) && ringState == FingerState.Closed && pinkyState == FingerState.Closed) { POSE = 'Х' }
                    //ч+г
                    if ((thumbState == FingerState.Open) && !(indexState == FingerState.Closed) && (middleState == FingerState.Closed) && ringState == FingerState.Closed && pinkyState == FingerState.Closed) {
                        if (isFingersNear(INDEX_FINGER_TIP, THUMB_TIP, 0.1 * distanceForScale)) { POSE = 'Ч' }
                        else {
                            if (angle(THUMB_TIP, THUMB_CMC, INDEX_FINGER_MCP) > 80) { POSE = 'Г' }
                        }
                    }
                    //ы
                    if (thumbState == FingerState.Open && indexState == FingerState.Open && middleState == FingerState.Closed && ringState == FingerState.Closed && pinkyState == FingerState.Open) { POSE = 'Ы' }
                    //э
                    if ((thumbState == FingerState.SemiOpen) && indexState == FingerState.SemiOpen && middleState == FingerState.Closed && ringState == FingerState.Closed && pinkyState == FingerState.Closed) { POSE = 'Э' }
                    //ю
                    if (thumbState == FingerState.Open && middleState == FingerState.SemiOpen && ringState == FingerState.SemiOpen && pinkyState == FingerState.Open && !isFingersNear(PINKY_TIP, RING_FINGER_TIP, 0.1 * distanceForScale) && isFingersNear(THUMB_TIP, INDEX_FINGER_TIP, 0.1 * distanceForScale)) {
                        POSE = 'Ю'
                    }
                    //я
                    if (thumbState == FingerState.Open && !(indexState == FingerState.Closed) && !(middleState == FingerState.Closed) && ringState == FingerState.Closed && pinkyState == FingerState.Closed && isFingersNear(INDEX_FINGER_PIP, MIDDLE_FINGER_PIP, 0.1 * distanceForScale)) { POSE = 'Я' }

                    positionOfIFTip.push(INDEX_FINGER_TIP);
                    arrayOfPoses.push(POSE);
                    if (arrayOfPoses.length > framerate / 2) {
                        if (needToDivide(arrayOfPoses) || (arrayOfPoses.length > framerate * 2)) {
                            let staticDactileme = getMostFrequentValue(arrayOfPoses);
                            if (staticDactileme == "К") {
                                if (less(positionOfIFTip[1].y, positionOfIFTip[positionOfIFTip.length - 1].y, 0.1 * distanceForScale)) {
                                    if (Math.abs(positionOfIFTip[1].x - positionOfIFTip[positionOfIFTip.length - 1].x) < 0.2 * distanceForScale) {
                                        staticDactileme = "Ц"
                                    }
                                    else staticDactileme = "К"
                                }
                                else staticDactileme = "Д"
                            }
                            if (staticDactileme == "Ш") {
                                if (less(positionOfIFTip[1].y, positionOfIFTip[positionOfIFTip.length - 1].y, 0.1 * distanceForScale)) {
                                    staticDactileme = "Щ"
                                }
                                else staticDactileme = "Ш"
                            }
                            document.getElementById('textbox').value += staticDactileme;
                            arrayOfPoses = []
                            positionOfIFTip = []
                        }
                    }

                    //log(`Показана дактилема: ${POSE}`)

                }
            } catch (err) {
                log('В твоём коде ошибка: ' + err)
            }
        })

        log('Инициализация камеры...')
        $.input.srcObject = stream
        $.input.onloadedmetadata = () => {
            log('Мета-данные загружены, показываем изображение и рендерим первый кадр...')
            $.input.play()
            sendAndRender()
        }
    })
    .catch(function (err) {
        log('Критическая ошибка при инициализации. Подробности в консоли: ' + err)
        console.error(err)
    })

class Vector2 {
    x = 0
    y = 0

    constructor(x, y) {
        this.x = Number(x)
        this.y = Number(y)
    }

    /**
     * Возвращает дистанцию между двумя точками
     * @param {Vector2} a
     * @param {Vector2} b
     */
    static distance(a, b) {
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
    }
}

function distanceTwoDots(a, b) { return Vector2.distance(a, b) }

function isFingersNear(a, b, x) {
    return Vector2.distance(a, b) < x
}

function orientation(a, b) {
    //ориентация ладони - если a правее b, то true
    if (a.x < b.x) { return true }
    else { return false }
}

function less(a, b, x) {
    //a<b и расстояние больше x
    if (a < b && Math.abs(b - a) > x) { return true }
    else { return false }
}

/**
 * 
 * @param {string[]} array 
 * @returns {boolean}
 */
/**
 * @param {any[]} array
 */
function needToDivide(arr) {
    //смена буквы
    let k = 0;
    let result = false;
    if (arr[1] != arr[arr.length - k]) { k++; }
    if (k > 5) { result = true; }
    return result;
}

/**
 * 
 * @param {string[]} array 
 * @returns {string}
 */
/**
 * @param {any[]} array
 */
function getMostFrequentValue(array) {
    const count = {}

    for (const element of array) {
        count[element] = element in count ? count[element] + 1 : 1
    }

    if (Object.entries(count).sort((a, b) => b[1] - a[1])[0][0] != "NULL") { return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0] }
    else return "";
}

function angle(a, b, c) {
    //угол
    let ab = new Vector2(0, 0)
    let bc = new Vector2(0, 0)
    let abc = 0
    let ab1 = 0
    let bc1 = 0
    ab.x = b.x - a.x
    ab.y = b.y - a.y
    bc.x = c.x - b.x
    bc.y = c.y - b.y
    ab1 = Math.sqrt(ab.x * ab.x + ab.y * ab.y)
    bc1 = Math.sqrt(bc.x * bc.x + bc.y * bc.y)
    abc = ab.x * bc.x + ab.y * bc.y
    return Math.abs(190 - (180 * (Math.acos((abc / (ab1 * bc1)))) / Math.PI))
}

function more(a, b, x) {
    //ориентация пальца
    if (a > b && Math.abs(a - b) > x) { return true }
    else { return false }
}

function direction(a, b)
//a - запястье, b - любой палец
{
    let dir = 'Left'
    if (Math.abs(b.x - a.x) < 0.1) //направление - вверх вниз 
    {
        if (a.y > b.y) { dir = 'Up' }
        else { dir = 'Down' }
    }
    else {
        if (a.x < b.x) { dir = 'Right' }
        else { dir = 'Left' }
    }
    return dir
}

function sendAndRender() {
    requestAnimationFrame(() => {
        g.hands.send({
            image: $.input
        })
    })
}

function getMaxResolution(source, max) {
    const ratio = {
        w: max.w / source.w,
        h: max.h / source.h
    }

    const best = Math.min(ratio.w, ratio.h)

    return {
        w: source.w * best,
        h: source.h * best
    }
}

function log(text) {
    //$.log.textContent = `${text}\n${$.log.textContent}`
}
