contract BlockNumber {

  function() {
    checkPoint = block.number;
  }

  uint checkPoint;
}
