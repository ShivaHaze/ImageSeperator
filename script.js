var http    = require('http')
var fs      = require('fs') 
var Canvas  = require('canvas');
var	query   = require('cli-interact').getYesNo;

var noiseThreshold = 200;
var extraWhitespace = 10; // half of it on each side

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

function move(direction, currentCoords){
    var currentX = currentCoords[0];
    var currentY = currentCoords[1];

    if(direction == 'right') currentX++;
    if(direction == 'down') currentY++;
    if(direction == 'left') currentX--;
    if(direction == 'up') currentY--;

    return [currentX, currentY];
}

function moveable(direction, currentCoords, pixeldata){
    var accessible = false;
    var currentX = currentCoords[0];
    var currentY = currentCoords[1];

    if(direction == 'right') currentX++;
    if(direction == 'down') currentY++;
    if(direction == 'left') currentX--;
    if(direction == 'up') currentY--;

    offset = (pixeldata.width * currentY + currentX) * 4;
    r = pixeldata.data[offset];   // rot

    if(r == 255) accessible = true;

    return accessible;
}

function getBorders(pixeldata) {

    console.log("Getting borders..");
    
    var border = [];
    var borders = [];
    
    var currentCoords = [];
    var startCoords = [];
    var facing = 'right';

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

            if(border.length == 0){
                // if( r == 255 && rTop == 255 &&
                //     r == 255 && rTopRight == 255 &&
                //     r == 255 && rRight == 255 &&
                //     r == 255 && rBottomRight == 0 &&
                //     r == 255 && rBottom == 255 && 
                //     r == 255 && rBottomLeft == 255 &&
                //     r == 255 && rLeft == 255 &&
                //     r == 255 && rTopLeft == 255){

                if( r == 255 && rBottomRight == 0 &&
                    r == 255 && rRight == 255){

                        if(JSON.stringify(borders).indexOf(JSON.stringify([x, y])) == -1){
                            currentCoords = [x, y];
                            startCoords = [x, y];
                            border.push([x, y]);
                    }
                }
            }

            while(border.length > 0){
                if(border.length == 1){
                    currentCoords = move('right', currentCoords);
                    border.push(currentCoords);
                    facing = 'down';
                }else{
                    if(facing == 'up'){
                        if(moveable('up', currentCoords, pixeldata)){
                            currentCoords = move('up', currentCoords);
                            border.push(currentCoords);
                            facing = 'right';
                        }else{
                            facing = 'left';
                        }
                    }else if(facing == 'right'){
                        if(moveable('right', currentCoords, pixeldata)){
                            currentCoords = move('right', currentCoords);
                            border.push(currentCoords);
                            facing = 'down';
                        }else{
                            facing = 'up';
                        }
                    }else if(facing == 'down'){
                        if(moveable('down', currentCoords, pixeldata)){
                            currentCoords = move('down', currentCoords);
                            border.push(currentCoords);
                            facing = 'left';
                        }else{
                            facing = 'right';
                        }
                    }else if(facing == 'left'){
                        if(moveable('left', currentCoords, pixeldata)){
                            currentCoords = move('left', currentCoords);
                            border.push(currentCoords);
                            facing = 'up';
                        }else{
                            facing = 'down';
                        }
                    }
                }

                if(JSON.stringify(currentCoords) == JSON.stringify(startCoords)){
                    if(border.length <= 4){
                        console.log('Object too small - scraped')
                        border = [];
                    }else{    
                        console.log('Object finished');
                        borders.push(border);
                        border = [];
                    }
                }
            }
        }
    }


    return borders;
}

function drawState(ctx, pixeldata, location){

    offset = (pixeldata.width * location[1] + location[0]) * 4;
    pixeldata.data[offset] = 0;;   // rot
    pixeldata.data[offset + 1] = 0; // grün
    pixeldata.data[offset + 2] = 255; // blau
    // pixeldata.data[offset + 3]; // Transparenz

    ctx.putImageData(pixeldata, 0, 0);
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
                    //console.log('a ' + a + ' in b' + b);
                    if(!verifyObjectInObject(coordValues[b], coordValues[a], b, a, borders, pixeldata)){
                        if(!indexToDelete.includes(a)) indexToDelete.push(a);
                    }
            }else if(coordValues[a][0] < coordValues[b][0] &&
                coordValues[a][1] < coordValues[b][1] &&
                coordValues[a][2] > coordValues[b][2] &&
                coordValues[a][3] > coordValues[b][3]) {
                    //console.log('b ' + b + ' in a ' +  a);
                    if(!verifyObjectInObject(coordValues[a], coordValues[b], a, b, borders, pixeldata)){
                        if(!indexToDelete.includes(b)) indexToDelete.push(b);
                    }
            }
        }
    }

    indexToDelete.sort(sortNumber);

    var counter = 0;

    for(var x = 0; x < indexToDelete.length; x++){
        borders.splice(indexToDelete[x]-counter, 1);
        counter++;
    }

    return borders;
}

function verifyObjectInObject2(outerBB, innerBB, outerIndex, innerIndex, borders, pixeldata) {

    console.log("Verifying that object is in another object..");

    var goalReached = false;
    var startPointReached = false;
    var innerBorder = borders[innerIndex];
    var startPoint = innerBorder[0];
    var firstHit = false;
    var movePoint  = [...innerBorder[0]];




    return goalReached
}

function sortNumber(a, b) {
    return a - b;
}

function verifyObjectInObject(outerBB, innerBB, outerIndex, innerIndex, borders, pixeldata) {

    //console.log("Verifying that object is in another object..");

    var goalReached = false;
    var startPointReached = false;

    // var outerBorder = borders[outerIndex];
    var innerBorder = borders[innerIndex];

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

    offset = (pixeldata.width * tempCoords[0][1] + (tempCoords[0][0]-1)) * 4;
    r = pixeldata.data[offset];

    if(r == 255){
        // console.log("black");
        colorOfObject = 'black';
    }else{
        //console.log("white");
        colorOfObject = 'white';
    }

    // console.log('outerBB' , outerBB);
    // console.log('innerBB' , innerBB);
    // console.log('outerIndex', outerIndex);
    // console.log('innerIndex', innerIndex);

    // console.log('innerBorder', innerBorder);

   // if colorOfObject is white, skip process - it's an inner border       
    if(colorOfObject == 'black'){
        while(goalReached != true && startPointReached != true){
            
            
            console.log('MoveCounter: ', moveSetCounter);
            console.log('Position: ', movePoint);

            if(moveSetCounter % 4 == 0){ //left
                offset = (pixeldata.width * movePoint[1] + (movePoint[0]-1)) * 4;
                r = pixeldata.data[offset];
                // console.log(r);
                if(r == 255){
                    movePoint[0]--;
                    if(moveSetCounter != 0) moveSetCounter--;
                }else{
                    moveSetCounter++;
                }
            }else if(moveSetCounter % 4 == 1){ // down
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
            }else if(moveSetCounter % 4 == 2){ // right
                offset = (pixeldata.width * movePoint[1] + (movePoint[0]+1)) * 4;
                r = pixeldata.data[offset];

                if(r == 255){
                    movePoint[0]++;
                    moveSetCounter--;
                }else{
                    moveSetCounter++;
                }
            }else if(moveSetCounter % 4 == 3){ // up
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

            if(moveSetCounter >= 300){
                startPointReached = true;
                console.log("Excessive movement, aborting.");
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

function removeInnerBorders(borders, pixeldata){

    var indexToDelete = [];

    for(var a = 0; a < borders.length; a++){
        console.log(borders[a][0]);
        offset = (pixeldata.width * (borders[a][0][1]) + (borders[a][0][0]+1)) * 4;
        r = pixeldata.data[offset]; // Color of current bordered object 
        console.log(a, r);
        if(r == 255){ // white
            indexToDelete.push(a);
        }
    }

    var counter = 0;
    console.log("indexToDelete", indexToDelete);
    for(var x = 0; x < indexToDelete.length; x++){
        borders.splice(indexToDelete[x]-counter, 1);
        counter++;
    }

    return borders;
}

http.createServer(function (req, res) {
    if (req.url != '/favicon.ico') {   
        fs.readFile(__dirname + '/images/micro_border.png', function(err, data) {
            if (err) throw err;

            var img = new Canvas.Image; // Create a new Image
            img.src = data;
            
            var canvas = Canvas.createCanvas(img.width + extraWhitespace, img.height + extraWhitespace);
            var ctx = canvas.getContext('2d');
            
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.drawImage(img, extraWhitespace/2, extraWhitespace/2, img.width, img.height);

            var pixeldata = ctx.getImageData(0, 0, canvas.width, canvas.height);

            pixeldata = filterNoise(pixeldata);

            ctx.putImageData(pixeldata, 0, 0);

            var borders = getBorders(pixeldata);

            //var borders = removeInnerBorders(borders, pixeldata);

            var borders = filterBorders(borders, pixeldata);

            drawBorders(ctx, borders);

            //ctx.clearRect(0, 0, canvas.width, canvas.height);
        
            //saveBordersAsImages(canvas, borders);

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