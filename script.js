var http    = require('http')
var fs      = require('fs') 
var Canvas  = require('canvas');
var	query   = require('cli-interact').getYesNo;

// const { createWorker } = require('tesseract.js');

// const worker = createWorker();

// (async () => {
//     await worker.load();
//     await worker.loadLanguage('eng');
//     await worker.initialize('eng');
//     await worker.setParameters({
//       tessedit_create_box: '1',
//       tessedit_create_unlv: '1',
//       tessedit_create_osd: '1',
//       tessedit_char_whitelist: '0123456789'
//     });
//     const { data: { text, hocr, tsv, box, unlv } } = await worker.recognize('https://i.stack.imgur.com/KVmJd.png');
//     //console.log(text);
//     console.log(hocr);
//     //console.log(tsv);
//     //console.log(box);
//     //console.log(unlv);
//   })();

var noiseThreshold = 200;
var extraWhitespace = 10;

function pixelIsTouching (coord1, coord2){

    if(coord1[0] == coord2[0] && 
      (coord1[1] == coord2[1]+1 ||
      coord1[1] == coord2[1]-1)){
        return true;
    }else if(coord1[1] == coord2[1] && 
            (coord1[0] == coord2[0]+1 ||
            coord1[0] == coord2[0]-1)){
        return true;
    }else{
        return false;
    }
}

function filterNoise(pixeldata) {
    
    //console.log("Filtering Noise..");

    for(var x = 0; x < pixeldata.data.length; x+=4){
        if( pixeldata.data[x] < noiseThreshold) {
            pixeldata.data[x] = 0;
            pixeldata.data[x+1] = 0;
            pixeldata.data[x+2] = 0;
        }else if(pixeldata.data[x] >= noiseThreshold) {
            pixeldata.data[x] = 255;
            pixeldata.data[x+1] = 255;
            pixeldata.data[x+2] = 255;
        }
    }

    return pixeldata;
}

function getBorders(pixeldata) {
    // Bilddaten pixelweise abarbeiten
    var border = [];

    console.log("Getting borders..");

    for (x = 0; x < pixeldata.width; x++) {

        for (y = 0; y < pixeldata.height; y++) {

            offset = (pixeldata.width * y + x) * 4;
            r = pixeldata.data[offset];   // rot
            g = pixeldata.data[offset + 1]; // grün
            b = pixeldata.data[offset + 2]; // blau
            a = pixeldata.data[offset + 3]; // Transparenz

            topOffset           = (pixeldata.width * (y-1) + x) * 4;
            rTop                = pixeldata.data[topOffset];

            topRightOffset      = (pixeldata.width * (y-1) + (x+1)) * 4;
            rTopRight           = pixeldata.data[topRightOffset];

            rightOffset         = (pixeldata.width * y + (x+1)) * 4;
            rRight              = pixeldata.data[rightOffset];

            bottomRightOffset   = (pixeldata.width * (y+1) + (x+1)) * 4;
            rBottomRight        = pixeldata.data[bottomRightOffset];

            bottomOffset        = (pixeldata.width * (y+1) + x) * 4;
            rBottom             = pixeldata.data[bottomOffset];

            bottomLeftOffset    = (pixeldata.width * (y+1) + (x-1)) * 4;
            rBottomLeft         = pixeldata.data[bottomLeftOffset];

            leftOffset          = (pixeldata.width * y + (x-1)) * 4;
            rLeft               = pixeldata.data[leftOffset];
            
            topLeftOffset       = (pixeldata.width * (y-1) + (x-1)) * 4;
            rTopLeft            = pixeldata.data[topLeftOffset];

            // if((x == 16 || x == 17) && (y == 155 || y == 154 || y == 153)){
            //     query(x + ' ' + y, true);
            //     console.log('r', r);
            //     console.log('rTop', rTop);
            //     console.log('rTopRight', rTopRight);
            //     console.log('rRight', rRight);
            //     console.log('rBottomRight', rBottomRight);
            //     console.log('rBottom', rBottom);
            //     console.log('rBottomLeft', rBottomLeft);
            //     console.log('rLeft', rLeft);
            //     console.log('rTopLeft', rTopLeft);
            // }

            // Check around current white pixel if black one is near
            if( r == 255 && rTop == 0 ||
                r == 255 && rTopRight == 0 ||
                r == 255 && rRight == 0 ||
                r == 255 && rBottomRight == 0 ||
                r == 255 && rBottom == 0 || 
                r == 255 && rBottomLeft == 0 ||
                r == 255 && rLeft == 0 ||
                r == 255 && rTopLeft == 0){

                    border.push([x, y]);
            }
        }
    }

    console.log("Ordering borders..");

    //Order border array
    var borderscounter = 0;
    var borders = [[]];

    var coordFound = undefined;

    borders[borderscounter].push(border[0]);
    border.shift();


    while(border.length > 0){

        coordFound = false;

        for(a = 0; a < border.length; a++){

            lastBlobElement = borders[borderscounter].length-1;

            if(pixelIsTouching(border[a], borders[borderscounter][lastBlobElement])){
                
                coordFound = true;
                borders[borderscounter].push(border[a]);
                border.splice(a, 1);
                
            }
        }

        if(coordFound == false && border.length > 0){
            borderscounter++;
            borders[borderscounter] = [];
            borders[borderscounter].push(border[0]);
            border.shift();
        }
    }

    return borders;
}

function drawBorders(ctx, borders) {
    // Draw Line via Border Array

    console.log("Drawing borders..");

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'red';
    ctx.beginPath();

    for(b = 0; b < borders.length; b++){
        for(var a = 0; a < borders[b].length; a++){

            // + 0.5 to get rid of blurry lines
            if(a == 0){
                ctx.moveTo(borders[b][a][0]+0.5, borders[b][a][1]);
            }else{
                ctx.lineTo(borders[b][a][0]+0.5, borders[b][a][1]);
            }

            if(a == borders[b].length-1){
                ctx.closePath();
            }
        }
    }

    ctx.stroke();
}

function saveBordersAsImages(img, borders) {

    console.log("Saving images via borders..");

    // Calculate x and y of borders down to the edge to get a small picture
    // And get the x and y width to limit canvas size
    for(l = 0; l < borders.length; l++){
        // Smallest & Biggest X, Y coordinate on original
        smallestX = undefined;
        smallestY = undefined;
        biggestX = undefined;
        biggestY = undefined;
        // New length & height
        xLength  = undefined;
        yHeight  = undefined;

        for(y = 0; y < 4; y++){
            for(x = 0; x < borders[l].length; x++){
                if(y == 0){
                    if(x == 0){
                        smallestX = borders[l][x][0];
                        biggestX = borders[l][x][0];
                    }else{
                        if(borders[l][x][0] < smallestX) smallestX = borders[l][x][0];
                        if(borders[l][x][0] > biggestX) biggestX = borders[l][x][0];
                    } 
                }else if(y == 1){
                    if(x == 0){
                        smallestY = borders[l][x][1];
                        biggestY = borders[l][x][1];
                    }else{
                        if(borders[l][x][1] < smallestY) smallestY = borders[l][x][1];
                        if(borders[l][x][1] > biggestY) biggestY = borders[l][x][1];
                    } 
                }else if(y == 2){
                    borders[l][x][0] -= smallestX;
                    if(x == 0){
                        xLength = borders[l][x][0];
                    }else{
                        if(borders[l][x][0] > xLength) xLength = borders[l][x][0];
                    } 
                }else if(y == 3){
                    borders[l][x][1] -= smallestY;
                    if(x == 0){
                        yHeight = borders[l][x][1];
                    }else{
                        if(borders[l][x][1] > yHeight) yHeight = borders[l][x][1];
                    } 
                }
            }
        }

        xDistance = biggestX - smallestX;
        yDistance = biggestY - smallestY;

        var canvas = Canvas.createCanvas(xDistance, yDistance);
        var ctx = canvas.getContext('2d');

        // Define Clipping Path of currently first border
        ctx.beginPath();
        ctx.moveTo(borders[l][0][0], borders[l][0][1]);
        for(var i = 1; i < borders[l].length; i++){
            var p = borders[l][i];
            ctx.lineTo(borders[l][i][0], borders[l][i][1]);
        }
        ctx.closePath();
        ctx.clip();

        // Draw original Image over canvas with clipping area defined
        ctx.drawImage(img, smallestX, smallestY, xDistance, yDistance, 0, 0, xDistance, yDistance)
        var pixeldata = ctx.getImageData(0, 0, img.width, img.height);
        // filterNoise needed here..?
        pixeldata = filterNoise(pixeldata);
        pixeldata = transparentToWhite(pixeldata);
        ctx.putImageData(pixeldata, 0, 0);

        // save image as file
        var file = canvas.toDataURL("image/png");

        var data = file.replace(/^data:image\/\w+;base64,/, "");
        var buf = new Buffer(data, 'base64');
        fs.writeFile('cropped/image'+ l + '.png', buf, (error) => { /* handle error */ });
    }

    console.log("Done.\n");
}

function transparentToWhite(pixeldata) {
    for (x = 0; x < pixeldata.width; x++) {

        for (y = 0; y < pixeldata.height; y++) {

            offset = (pixeldata.width * y + x) * 4;
            r = pixeldata.data[offset];   // rot
            g = pixeldata.data[offset + 1]; // grün
            b = pixeldata.data[offset + 2]; // blau
            a = pixeldata.data[offset + 3]; // Transparenz

            if(a == 0) {
                pixeldata.data[offset] = 255;
                pixeldata.data[offset + 1] = 255;
                pixeldata.data[offset + 2] = 255;
                pixeldata.data[offset + 3] = 255;
            }
        }
    }

    return pixeldata;
}

function filterBorders(borders, pixeldata) {

    console.log("Filtering borders..")

    var smallX = null;
    var smallY = null;
    var bigX   = null;
    var bigY   = null;

    var coordValues = [];
    var indexToDelete = [];

    for(var a = 0; a < borders.length; a++){       
        for(var b = 0; b < borders[a].length; b++){
            if(b == 0){
                smallX = borders[a][b][0];
                bigX   = borders[a][b][0];
                smallY = borders[a][b][1];
                bigY   = borders[a][b][1];
            }else{
                if(borders[a][b][0] < smallX) smallX = borders[a][b][0];
                if(borders[a][b][0] > bigX) bigX = borders[a][b][0];
                if(borders[a][b][1] < smallY) smallY = borders[a][b][1];
                if(borders[a][b][1] > bigY) bigY = borders[a][b][1]; 
            }
        }    
        coordValues.push([smallX, smallY, bigX, bigY]);
    }

    //verifyObjectInObject(borders, coordValues);

    //console.log(coordValues);

    for(var a = 0; a < coordValues.length; a++){
        for(var b = a+1; b < coordValues.length; b++){

            if(coordValues[a][0] > coordValues[b][0] &&
                coordValues[a][1] > coordValues[b][1] &&
                coordValues[a][2] < coordValues[b][2] &&
                coordValues[a][3] < coordValues[b][3]) {
                    // console.log(a + ' in ' + b);
                    if(!verifyObjectInObject(coordValues[b], coordValues[a], b, a, borders, pixeldata)){
                        if(!indexToDelete.includes(a)) indexToDelete.push(a);
                    }
            }else if(coordValues[a][0] < coordValues[b][0] &&
                coordValues[a][1] < coordValues[b][1] &&
                coordValues[a][2] > coordValues[b][2] &&
                coordValues[a][3] > coordValues[b][3]) {
                    // console.log(b + ' in ' + a);
                    if(!verifyObjectInObject(coordValues[a], coordValues[b], a, b, borders, pixeldata)){
                        if(!indexToDelete.includes(b)) indexToDelete.push(b);
                    }
            }
        }
    }

    indexToDelete.sort(sortNumber);

    //console.log(indexToDelete);
    
    // Huge Error, not correctly finding borders IN borders, check micro.png numbers on corners.
    var counter = 0;

    for(var x = 0; x < indexToDelete.length; x++){
        borders.splice(indexToDelete[x]-counter, 1);
        counter++;
    }

    return borders;
}

function sortNumber(a, b) {
    return a - b;
}

function verifyObjectInObject(outerBB, innerBB, outerIndex, innerIndex, borders, pixeldata) {

    console.log("Verifying that object is in another object..");

    var goalReached = false;
    var startPointReached = false;

    // var outerBorder = borders[outerIndex];
    var innerBorder = borders[innerIndex];


    // console.log('borders', borders);

    // console.log('outerBB' , outerBB);
    // console.log('innerBB' , innerBB);
    // console.log('outerIndex', outerIndex);
    // console.log('innerIndex', innerIndex);

    // console.log('innerBorder', innerBorder);

    var startPoint = innerBorder[0];
    var firstHit = false;
    var movePoint  = [...innerBorder[0]];
    // var hitPoint = null;

    // var moveSet = {
    //     0: left,
    //     1: down,
    //     2: right,
    //     3: up
    // }

    var moveSetCounter = 0;

    var colorOfObject = null;

    var tempCoords = [];

    // Get Color of inner Object to define exclude rule
    for(a = 0; a < innerBorder.length; a++){
        if(innerBorder[a][0] == innerBB[0]){
            // Min X point, go one right, check color
            tempCoords.push(innerBorder[a]);
        }
    }

    // TypeError: Cannot read property '1' of undefined || Some weird borders are found - why??
    offset = (pixeldata.width * tempCoords[1][1] + (tempCoords[1][0]+1)) * 4;
    r = pixeldata.data[offset];

    // Edgy but works at the moment.
    // done. Not sure if works perfectly "(CHANGE THIS NOT TO TAKE COLOR OF MEDIAN BUT THE SECOND AS IT SHOULD ALWAYS HIT!)"

    if(r == 255){
        console.log("white");
        colorOfObject = 'white';
    }else{
        console.log("black");
        colorOfObject = 'black';
    }

   // if colorOfObject is white, skip process - it's an inner border       
    if(colorOfObject == 'black'){
        while(goalReached != true && startPointReached != true){
            
            // console.log('MoveCounter: ', moveSetCounter);
            
            if(moveSetCounter % 4 == 0){
                offset = (pixeldata.width * movePoint[1] + (movePoint[0]-1)) * 4;
                r = pixeldata.data[offset];
                // console.log(r);
                if(r == 255){
                    movePoint[0]--;
                    if(moveSetCounter != 0) moveSetCounter--;
                }else{
                    moveSetCounter++;
                }
            }else if(moveSetCounter % 4 == 1){
                if(firstHit != true){
                    firstHit = true;
                    startPoint = [...movePoint];
                    // console.log("new Startpoint: ", startPoint);
                }
                offset = (pixeldata.width * (movePoint[1]+1) + movePoint[0]) * 4;
                r = pixeldata.data[offset];

                if(r == 255){
                    movePoint[1]++;
                    moveSetCounter--;
                }else{
                    moveSetCounter++;
                }
            }else if(moveSetCounter % 4 == 2){
                offset = (pixeldata.width * movePoint[1] + (movePoint[0]+1)) * 4;
                r = pixeldata.data[offset];

                if(r == 255){
                    movePoint[0]++;
                    moveSetCounter--;
                }else{
                    moveSetCounter++;
                }
            }else if(moveSetCounter % 4 == 3){
                offset = (pixeldata.width * (movePoint[1]-1) + movePoint[0]) * 4;
                r = pixeldata.data[offset];

                if(r == 255){
                    movePoint[1]--;
                    moveSetCounter--;
                }else{
                    moveSetCounter++;
                }
            }


            // console.log('StartPoint: ', startPoint);
            // console.log('MovePoint: ' , movePoint);
            // console.log(outerBB);

                        
            if(movePoint[0] < outerBB[0] ||
                movePoint[0] > outerBB[2] ||
                movePoint[1] < outerBB[1] ||
                movePoint[1] > outerBB[3] ) {
                    goalReached = true;
                    console.log("Goal Reached!");
                }

            if(movePoint[0] == startPoint[0] &&
                movePoint[1] == startPoint[1]) {
                    startPointReached = true;
                    // console.log("AYE ", movePoint[0], startPoint[0], movePoint[1], startPoint[1])
                    console.log("StartPoint Reached!");
                }

            // if(JSON.stringify(outerBorder).indexOf(JSON.stringify(movePoint)) != -1){
            //     hitPoint = movePoint;
            // }

            // if(movePoint[0] < outerBB[0]) goalReached = true;
        
        }    
    }
    // console.log('GoalReached ', goalReached);
    return goalReached
}

http.createServer(function (req, res) {
    if (req.url != '/favicon.ico') {   
        fs.readFile(__dirname + '/images/multistar_correct_edge2.jpg', function(err, data) {
            if (err) throw err;

            var img = new Canvas.Image; // Create a new Image
            img.src = data;
            // query('Press any key to continue..', true);
            var canvas = Canvas.createCanvas(img.width + extraWhitespace, img.height + extraWhitespace);
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, extraWhitespace/2, extraWhitespace/2, img.width, img.height);

            var pixeldata = ctx.getImageData(0, 0, canvas.width, canvas.height);

            pixeldata = filterNoise(pixeldata);

            ctx.putImageData(pixeldata, 0, 0);
            
            var borders = getBorders(pixeldata);

            console.log(borders);

            var borders = filterBorders(borders, pixeldata);

            drawBorders(ctx, borders);

            //ctx.clearRect(0, 0, canvas.width, canvas.height);
        
            saveBordersAsImages(canvas, borders);

            res.write('<html><body>');
            res.write('<img src="' + canvas.toDataURL() + '" />');
            res.write('</body></html>');
            res.end();
        });
    }
}).listen(8124, "127.0.0.1");
console.log('Server running at http://127.0.0.1:8124/\n');


 

 

/*
var cannyEdgeDetector = require('canny-edge-detector');
var Image = require('image-js').Image;
 
Image.load('images/b7b.png').then((img) => {
  const grey = img.grey();
  const edge = cannyEdgeDetector(grey, { gaussianBlur:2, lowThreshold: 20, highThreshold:40 });
  return edge.save('images/edge.png');
})
*/ 

/*
var Jimp = require('jimp');
 
var title = 'b7b.png';

// open a file called "lenna.png"
Jimp.read('images/' + title , (err, picture) => {
  if (err) throw err;
  picture
    //.resize(256, 256) // resize
    //.quality(60) // set JPEG quality
    //.greyscale() // set greyscale
    //.gaussian(2)
    .blur(10)
    .write('images/edit_' + title); // save
});
*/