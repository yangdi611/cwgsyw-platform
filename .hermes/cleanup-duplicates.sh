#!/bin/bash
cd "/Users/byron/Library/Mobile Documents/com~apple~CloudDocs/AI/cwgsyw-platform"
count=$(find . -name '* 2.java' -not -path '*/target/*' | wc -l)
echo "Removing $count ' 2.java' files..."
find . -name '* 2.java' -not -path '*/target/*' -delete
count2=$(find . -name '* 2.sql' -not -path '*/target/*' | wc -l)
echo "Removing $count2 ' 2.sql' files..."
find . -name '* 2.sql' -not -path '*/target/*' -delete
echo "Done"
